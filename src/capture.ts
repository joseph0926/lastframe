import { getChannel } from './channel';
import { collectStyles } from './css';
import { currentRoute, frameBytes, frameKey, type Frame, type FrameShellNode } from './frame';
import { debug, warn } from './log';
import { applyMask, measureMedia, needsMediaSizes, removeExcluded, type MediaSize } from './mask';
import { matchRoute, maskSignature } from './policy';
import { isEventHandlerAttribute } from './sanitize';
import { readScope } from './scope';
import { deleteLegacyDatabase, openDB, pruneFrames, writeFrame } from './storage';

export type CapturedFrame = Pick<Frame, 'route' | 'capturedAt'> & { bytes: number };

type CaptureListener = (frame: CapturedFrame) => void;

const IDLE_CAPTURE_TIMEOUT = 2000;

/**
 * Inherited and canvas-level properties of `<html>` and `<body>` are copied as
 * computed values, so the frame looks right even when the page's own CSS has not
 * loaded yet at boot.
 */
const SHELL_PROPERTIES = [
  'background-color',
  'color',
  'color-scheme',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'margin',
  'padding',
] as const;

const listeners = new Set<CaptureListener>();
let captureRoot: Element | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;
let stopListening: (() => void) | null = null;

function getDB(): Promise<IDBDatabase> {
  // One connection for the page's lifetime: on `pagehide` there is no time to open one.
  if (!dbPromise) {
    const opening = openDB().then((db) => {
      const forget = () => {
        if (dbPromise === opening) dbPromise = null;
      };
      db.addEventListener('close', forget);
      db.addEventListener('versionchange', forget);
      return db;
    });
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null;
    });
    dbPromise = opening;
  }
  return dbPromise;
}

function readShellNode(element: Element): FrameShellNode {
  const attrs: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === 'style' || isEventHandlerAttribute(attribute.name)) continue;
    if (attribute.name.startsWith('data-lastframe')) continue;
    attrs[attribute.name] = attribute.value;
  }
  let style = '';
  try {
    const computed = getComputedStyle(element);
    for (const property of SHELL_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value) style += `${property}:${value};`;
    }
  } catch {}
  return { attrs, style };
}

function readShell(): Frame['shell'] {
  const html = readShellNode(document.documentElement);
  const body = readShellNode(document.body);
  // The canvas takes the body background when <html> has none.
  if (/background-color:(?:transparent|rgba\(0, 0, 0, 0\));/.test(html.style)) {
    const bodyBackground = /background-color:([^;]+);/.exec(body.style)?.[1];
    if (bodyBackground) {
      html.style = html.style.replace(
        /background-color:[^;]+;/,
        `background-color:${bodyBackground};`,
      );
    }
  }
  return { html, body };
}

function resolveRoot(selector: string): Element | null {
  if (captureRoot?.isConnected) return captureRoot;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function serializeRoot(root: Element, mask: boolean | string[], exclude: string[]): string {
  const clone = root.cloneNode(true) as Element;
  const sizes = needsMediaSizes(clone, mask)
    ? measureMedia(root, clone)
    : new Map<Element, MediaSize>();
  removeExcluded(clone, exclude);
  applyMask(clone, mask, sizes);
  clone.querySelectorAll('input[type="password" i]').forEach((input) => {
    input.removeAttribute('value');
  });
  for (const element of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      if (isEventHandlerAttribute(attribute.name)) element.removeAttribute(attribute.name);
    }
  }
  return clone.outerHTML;
}

/**
 * Captures the current page as a frame right now. Lastframe already captures on
 * its own when the page is hidden and while idle; call this before navigations it
 * cannot see, such as `location.assign()`.
 *
 * Resolves to `null` when the page is not eligible: the app has not called
 * `ready()`, the route is not in the policy, or the frame is too large.
 */
export async function capture(): Promise<CapturedFrame | null> {
  const channel = getChannel();
  const policy = channel.policy;
  if (channel.status !== 'live' || !policy) return null;

  const route = currentRoute();
  const rule = matchRoute(policy, route);
  if (!rule) return null;

  const root = resolveRoot(policy.root);
  if (!root || !document.body) {
    warn(`Root element ${policy.root} was not found; nothing captured`);
    return null;
  }

  const scope = readScope();
  let frame: Frame;
  try {
    const { styles, fonts } = policy.styles ? collectStyles() : { styles: [], fonts: [] };
    frame = {
      key: frameKey(scope, route),
      route,
      scope,
      version: policy.version,
      mask: maskSignature(rule.mask),
      html: serializeRoot(root, rule.mask, policy.exclude),
      shell: readShell(),
      styles,
      fonts,
      capturedAt: Date.now(),
    };
  } catch (error) {
    warn(`Failed to serialize ${route}`, error);
    return null;
  }

  const bytes = frameBytes(frame);
  if (bytes > policy.maxBytes) {
    warn(`Frame for ${route} is ${bytes} bytes, over maxBytes (${policy.maxBytes}); skipped`);
    return null;
  }

  try {
    await writeFrame(await getDB(), frame);
  } catch (error) {
    warn(`Failed to store the frame for ${route}`, error);
    return null;
  }

  const captured: CapturedFrame = { route, capturedAt: frame.capturedAt, bytes };
  debug(`Captured ${route} (${(bytes / 1024).toFixed(1)} KiB)`);
  listeners.forEach((listener) => listener(captured));
  return captured;
}

/** Subscribes to captured frames. Returns an unsubscribe function. */
export function onCapture(listener: CaptureListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function pruneInBackground(): Promise<void> {
  const policy = getChannel().policy;
  deleteLegacyDatabase();
  try {
    const deleted = await pruneFrames(await getDB(), policy, readScope());
    if (deleted > 0) debug(`Pruned ${deleted} frame(s) the current policy would not show`);
  } catch (error) {
    warn('Failed to prune frames', error);
  }
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Registers the automatic capture triggers: once while idle after the app is
 * ready, whenever the page becomes hidden, and on `pagehide`. Called by `ready()`.
 * Calling it again only updates the root element.
 */
export function startCapture(root?: Element | null): void {
  if (root) captureRoot = root;
  if (stopListening) return;

  const idleWindow = window as IdleWindow;
  let inFlight: Promise<unknown> | null = null;
  let idleHandle: number | null = null;

  const save = () => {
    if (inFlight) return;
    inFlight = capture().finally(() => (inFlight = null));
  };

  const scheduleIdle = () => {
    if (idleHandle !== null) return;
    const run = () => {
      idleHandle = null;
      save();
    };
    idleHandle = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(run, { timeout: IDLE_CAPTURE_TIMEOUT })
      : window.setTimeout(run, IDLE_CAPTURE_TIMEOUT);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') save();
    else scheduleIdle();
  };

  document.addEventListener('visibilitychange', onVisibilityChange, { capture: true });
  window.addEventListener('pagehide', save, { capture: true });
  window.addEventListener('pageshow', scheduleIdle, { capture: true });
  scheduleIdle();
  void pruneInBackground();

  stopListening = () => {
    if (idleHandle !== null) {
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    }
    document.removeEventListener('visibilitychange', onVisibilityChange, { capture: true });
    window.removeEventListener('pagehide', save, { capture: true });
    window.removeEventListener('pageshow', scheduleIdle, { capture: true });
  };
}

/** Removes the automatic capture triggers registered by `ready()`. */
export function stopCapture(): void {
  stopListening?.();
  stopListening = null;
  captureRoot = null;
}

/** Test helper: drops the cached connection and listeners between tests. */
export async function resetCapture(): Promise<void> {
  stopCapture();
  listeners.clear();
  const pending = dbPromise;
  dbPromise = null;
  try {
    (await pending)?.close();
  } catch {}
}
