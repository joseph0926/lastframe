import { normalizePathname, type ResolvedPolicy, type ResolvedRoute } from './policy';

export type FrameStyle = { type: 'inline'; css: string } | { type: 'external'; href: string };

/** Attributes and a few computed properties of `<html>` or `<body>` at capture time. */
export interface FrameShellNode {
  attrs: Record<string, string>;
  style: string;
}

/** One stored frame: the visual state of a route the last time the user saw it. */
export interface Frame {
  key: string;
  route: string;
  scope: string | null;
  version: string | null;
  mask: string;
  html: string;
  shell: { html: FrameShellNode; body: FrameShellNode };
  styles: FrameStyle[];
  fonts: string[];
  capturedAt: number;
}

export interface FrameCheck {
  policy: ResolvedPolicy;
  route: ResolvedRoute;
  key: string;
  scope: string | null;
  maskSignature: string;
  now: number;
}

export function frameKey(scope: string | null, route: string): string {
  return `${scope ?? ''}|${route}`;
}

export function currentRoute(): string {
  try {
    const override = window.__LASTFRAME_ROUTE__;
    const value = typeof override === 'function' ? override() : override;
    if (typeof value === 'string' && value.startsWith('/')) return normalizePathname(value);
  } catch {}
  try {
    const pathname = window.location.pathname;
    if (pathname) return normalizePathname(pathname);
  } catch {}
  return '/';
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function frameBytes(frame: Pick<Frame, 'html' | 'styles' | 'fonts' | 'shell'>): number {
  return utf8Length(
    JSON.stringify([frame.html, frame.styles, frame.fonts, frame.shell.html, frame.shell.body]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** IndexedDB content is outside our control, so every field is checked before use. */
export function isFrameShape(value: unknown): value is Frame {
  if (!isRecord(value)) return false;
  const shell = value.shell;
  return (
    typeof value.key === 'string' &&
    typeof value.route === 'string' &&
    (value.scope === null || typeof value.scope === 'string') &&
    (value.version === null || typeof value.version === 'string') &&
    typeof value.mask === 'string' &&
    typeof value.html === 'string' &&
    typeof value.capturedAt === 'number' &&
    Array.isArray(value.styles) &&
    Array.isArray(value.fonts) &&
    isRecord(shell) &&
    isRecord(shell.html) &&
    isRecord(shell.body)
  );
}

/**
 * The single rule for whether a stored frame may be shown. Boot uses it to decide
 * whether to paint, and pruning uses the inverse to decide what to delete.
 */
export function isFrameUsable(value: unknown, check: FrameCheck): value is Frame {
  if (!isFrameShape(value)) return false;
  const { policy } = check;
  if (value.key !== check.key || value.scope !== check.scope) return false;
  if (value.version !== policy.version) return false;
  if (value.mask !== check.maskSignature) return false;
  if (check.now - value.capturedAt > policy.ttl || value.capturedAt > check.now + 60_000) {
    return false;
  }
  if (!policy.styles && (value.styles.length > 0 || value.fonts.length > 0)) return false;
  return frameBytes(value) <= policy.maxBytes;
}
