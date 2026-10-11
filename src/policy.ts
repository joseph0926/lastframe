/**
 * The policy decides which pages get a frame and how it is stored. The Vite plugin
 * validates it at build time and embeds the resolved form into the boot script, and
 * the runtime reads the same object back from the shared channel, so capture and
 * restore always agree on the rules.
 */

/** `true` masks the whole page; a selector list masks only the matching elements. */
export type MaskOption = boolean | readonly string[];

export interface RouteRule {
  /** Pathname pattern. `:param` matches one segment and a trailing `*` matches the rest. */
  path: string;
  /** Overrides the policy-wide `mask` setting for this route. */
  mask?: MaskOption;
}

export interface LastframePolicy {
  /** Routes that may be captured and restored. Nothing is captured until you list one. */
  routes: ReadonlyArray<string | RouteRule>;
  /** Replace text and media with skeleton blocks while keeping the layout. Default: `false`. */
  mask?: MaskOption;
  /** Selectors removed from every frame, such as toasts, modals, and chat widgets. */
  exclude?: readonly string[];
  /** Frames older than this are discarded. Default: 7 days. */
  ttl?: number;
  /** Frames larger than this many UTF-8 bytes are not stored. Default: 1 MiB. */
  maxBytes?: number;
  /** Only the most recently captured frames are kept. Default: 50. */
  maxFrames?: number;
  /** Store the page's CSS with each frame. Default: `true`. */
  styles?: boolean;
  /** The frame is removed this long after it was painted even without `ready()`. Default: 10 s. */
  timeout?: number;
  /** Frames captured under a different version are discarded. Set it to your release id. */
  version?: string;
  /** The element the app renders into. Default: `#root`. */
  root?: string;
}

export interface ResolvedRoute {
  path: string;
  mask: boolean | string[];
}

export interface ResolvedPolicy {
  routes: ResolvedRoute[];
  mask: boolean | string[];
  exclude: string[];
  ttl: number;
  maxBytes: number;
  maxFrames: number;
  styles: boolean;
  timeout: number;
  version: string | null;
  root: string;
}

export const DEFAULTS = {
  ttl: 7 * 24 * 60 * 60 * 1000,
  maxBytes: 1024 * 1024,
  maxFrames: 50,
  timeout: 10_000,
  root: '#root',
} as const;

type ParseResult = { policy: ResolvedPolicy | null; error: string | null };

const invalid = (error: string): ParseResult => ({ policy: null, error });

function isSelectorList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
}

function parseMask(value: unknown, fallback: boolean | string[]): boolean | string[] | null {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (isSelectorList(value)) return value.map((selector) => selector.trim());
  return null;
}

function parsePositive(value: unknown, fallback: number, integer: boolean): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (integer && !Number.isSafeInteger(value)) return null;
  return value;
}

function parsePolicy(input: unknown): ParseResult {
  if (input === undefined || input === null) return { policy: null, error: null };
  if (typeof input !== 'object') return invalid('the policy must be an object');

  const candidate = input as Partial<Record<keyof LastframePolicy, unknown>>;
  if (!Array.isArray(candidate.routes)) return invalid('`routes` must be an array');

  const mask = parseMask(candidate.mask, false);
  if (mask === null) return invalid('`mask` must be a boolean or a list of selectors');

  const routes: ResolvedRoute[] = [];
  for (const entry of candidate.routes as unknown[]) {
    const rule: Partial<Record<keyof RouteRule, unknown>> =
      typeof entry === 'string' ? { path: entry } : (entry ?? {});
    if (typeof rule.path !== 'string' || !rule.path.startsWith('/')) {
      return invalid('every route must be a pathname that starts with `/`');
    }
    const routeMask = parseMask(rule.mask, mask);
    if (routeMask === null) return invalid(`\`mask\` for ${rule.path} is invalid`);
    const path = normalizePathname(rule.path);
    if (!routes.some((route) => route.path === path)) routes.push({ path, mask: routeMask });
  }
  if (routes.length === 0) return { policy: null, error: null };

  const exclude = candidate.exclude ?? [];
  if (!isSelectorList(exclude)) return invalid('`exclude` must be a list of selectors');

  const ttl = parsePositive(candidate.ttl, DEFAULTS.ttl, false);
  if (ttl === null) return invalid('`ttl` must be a positive number of milliseconds');
  const maxBytes = parsePositive(candidate.maxBytes, DEFAULTS.maxBytes, true);
  if (maxBytes === null) return invalid('`maxBytes` must be a positive integer');
  const maxFrames = parsePositive(candidate.maxFrames, DEFAULTS.maxFrames, true);
  if (maxFrames === null) return invalid('`maxFrames` must be a positive integer');
  const timeout = parsePositive(candidate.timeout, DEFAULTS.timeout, false);
  if (timeout === null) return invalid('`timeout` must be a positive number of milliseconds');

  const styles = candidate.styles ?? true;
  if (typeof styles !== 'boolean') return invalid('`styles` must be a boolean');

  const version = candidate.version ?? null;
  if (version !== null && typeof version !== 'string') return invalid('`version` must be a string');

  const root = candidate.root ?? DEFAULTS.root;
  if (typeof root !== 'string' || !root.trim()) return invalid('`root` must be a selector');

  return {
    policy: {
      routes,
      mask,
      exclude: exclude.map((selector) => selector.trim()),
      ttl,
      maxBytes,
      maxFrames,
      styles,
      timeout,
      version,
      root: root.trim(),
    },
    error: null,
  };
}

/** Lenient form for the browser: an unusable policy disables Lastframe instead of throwing. */
export function normalizePolicy(input: unknown): ResolvedPolicy | null {
  return parsePolicy(input).policy;
}

/** Strict form for build time, so configuration mistakes fail the build. */
export function validatePolicy(input: unknown): ResolvedPolicy | null {
  const { policy, error } = parsePolicy(input);
  if (error) throw new Error(`[lastframe] Invalid options: ${error}`);
  return policy;
}

/** JSON that is safe to place inside an inline `<script>`. */
export function serializePolicy(policy: ResolvedPolicy | null): string {
  return JSON.stringify(policy)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function normalizePathname(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function matchesPattern(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  const patternSegments = pattern.split('/');
  const pathSegments = pathname.split('/');

  for (let index = 0; index < patternSegments.length; index += 1) {
    const segment = patternSegments[index];
    const isLast = index === patternSegments.length - 1;
    if (segment === '*' && isLast) return true;
    const value = pathSegments[index];
    if (value === undefined) return false;
    if (segment.startsWith(':')) {
      if (!value) return false;
      continue;
    }
    if (segment !== value) return false;
  }
  return patternSegments.length === pathSegments.length;
}

/** Exact paths win over patterns so a specific rule can override a broader one. */
export function matchRoute(policy: ResolvedPolicy | null, pathname: string): ResolvedRoute | null {
  if (!policy) return null;
  const normalized = normalizePathname(pathname);
  const exact = policy.routes.find((route) => route.path === normalized);
  if (exact) return exact;
  return policy.routes.find((route) => matchesPattern(route.path, normalized)) ?? null;
}

/** Stored with each frame, so a frame captured under a weaker mask is never replayed. */
export function maskSignature(mask: boolean | string[]): string {
  if (mask === true) return 'all';
  if (mask === false || mask.length === 0) return 'none';
  return [...mask].sort().join('\n');
}
