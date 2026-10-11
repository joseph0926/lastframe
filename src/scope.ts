const SCOPE_KEY = 'lastframe:scope';

/**
 * The boot script runs before the app knows who is signed in, so the scope has to
 * be readable synchronously from the previous visit. localStorage is the only
 * synchronous same-origin store available that early.
 */
export function readScope(): string | null {
  try {
    const value = window.localStorage.getItem(SCOPE_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

/**
 * Ties frames to an identity, such as a user id hash plus locale. Frames are only
 * replayed for the scope that captured them, and frames of other scopes are pruned.
 * Pass `null` on sign-out. Use an opaque value: it is stored in localStorage.
 */
export function setScope(scope: string | null): void {
  try {
    if (scope) window.localStorage.setItem(SCOPE_KEY, scope);
    else window.localStorage.removeItem(SCOPE_KEY);
  } catch {}
}
