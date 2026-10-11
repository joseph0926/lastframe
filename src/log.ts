declare const __LASTFRAME_DEV__: boolean | undefined;

/**
 * The Vite plugin defines `__LASTFRAME_DEV__` for app builds and the boot script
 * sets it as a global on the dev server, where pre-bundled dependencies miss the
 * static define. Without either, logging stays off.
 */
export function isDev(): boolean {
  try {
    return typeof __LASTFRAME_DEV__ !== 'undefined' && __LASTFRAME_DEV__ === true;
  } catch {
    return false;
  }
}

export function debug(message: string): void {
  if (isDev()) console.info(`[lastframe] ${message}`);
}

/** Lastframe never breaks the app: failures are reported and the page loads normally. */
export function warn(message: string, error?: unknown): void {
  if (!isDev()) return;
  if (error === undefined) console.warn(`[lastframe] ${message}`);
  else console.warn(`[lastframe] ${message}`, error);
}
