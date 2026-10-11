import { getChannel, type Channel } from './channel';
import { currentRoute, frameKey, isFrameUsable, type Frame } from './frame';
import { debug, warn } from './log';
import { mountOverlay, removeOverlay } from './overlay';
import { matchRoute, maskSignature, normalizePolicy } from './policy';
import { readScope } from './scope';
import { openDB, readFrame } from './storage';

function whenBodyReady(callback: () => void): void {
  if (document.body) {
    callback();
    return;
  }
  // A head script can finish its IndexedDB read before the parser reaches <body>.
  const observer = new MutationObserver(() => {
    if (!document.body) return;
    observer.disconnect();
    callback();
  });
  observer.observe(document.documentElement, { childList: true });
}

function paint(channel: Channel, frame: Frame, timeout: number): void {
  // `ready()` may have run while storage was being read; the app is already live.
  if (channel.status !== 'restored') return;
  if (!mountOverlay(frame)) return;

  const paintedAt = Date.now();
  channel.frame = { route: frame.route, capturedAt: frame.capturedAt, paintedAt };
  debug(`Painted ${frame.route} (captured ${paintedAt - frame.capturedAt} ms ago)`);

  channel.timeoutId = setTimeout(() => {
    channel.timeoutId = null;
    if (channel.status !== 'restored') return;
    removeOverlay();
    warn(
      `Frame removed after ${timeout} ms without ready(). Call ready() once your UI is on screen.`,
    );
  }, timeout);
}

/**
 * The boot step, run by the injected script before the app bundle. It reads the
 * frame for the current route and paints it. It never throws: any failure leaves
 * the page to load exactly as it would without Lastframe.
 */
export async function boot(policyInput: unknown): Promise<void> {
  const channel = getChannel();
  const policy = normalizePolicy(policyInput);
  channel.policy = policy;
  if (!policy || channel.status !== 'pending') return;

  const route = currentRoute();
  const rule = matchRoute(policy, route);
  if (!rule) return;

  channel.status = 'restoring';
  const scope = readScope();
  const key = frameKey(scope, route);
  let stored: unknown;
  try {
    const db = await openDB();
    try {
      stored = await readFrame(db, key);
    } finally {
      db.close();
    }
  } catch (error) {
    if (channel.status === 'restoring') channel.status = 'pending';
    warn('Could not read the stored frame', error);
    return;
  }

  if (channel.status !== 'restoring') return;
  const check = {
    policy,
    route: rule,
    key,
    scope,
    maskSignature: maskSignature(rule.mask),
    now: Date.now(),
  };
  if (!isFrameUsable(stored, check)) {
    channel.status = 'pending';
    return;
  }

  channel.status = 'restored';
  const frame: Frame = stored;
  whenBodyReady(() => {
    try {
      paint(channel, frame, policy.timeout);
    } catch (error) {
      removeOverlay();
      warn('Could not paint the frame', error);
    }
  });
}
