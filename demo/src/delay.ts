const DELAY_KEY = 'lastframe-demo:delay';
export const DEFAULT_DELAY = 2500;
export const MAX_DELAY = 6000;

export function readDelay(): number {
  try {
    const raw = window.localStorage.getItem(DELAY_KEY);
    const stored = raw === null ? Number.NaN : Number(raw);
    if (stored >= 0 && stored <= MAX_DELAY) return stored;
  } catch {}
  return DEFAULT_DELAY;
}

export function writeDelay(milliseconds: number): void {
  try {
    window.localStorage.setItem(DELAY_KEY, String(milliseconds));
  } catch {}
}
