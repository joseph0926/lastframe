import type { ResolvedPolicy } from './policy';

/**
 * - `pending`: nothing decided yet, or no frame applies to this page.
 * - `restoring`: the boot script is reading a frame from storage.
 * - `restored`: a frame is (or was) painted and the app has not called `ready()` yet.
 * - `live`: the app called `ready()`. Capture is allowed only in this state.
 */
export type LastframeStatus = 'pending' | 'restoring' | 'restored' | 'live';

export interface RestoredFrameInfo {
  route: string;
  capturedAt: number;
  paintedAt: number;
}

export interface Channel {
  policy: ResolvedPolicy | null;
  status: LastframeStatus;
  frame: RestoredFrameInfo | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

const CHANNEL_KEY = '__LASTFRAME__';

type ChannelGlobal = typeof globalThis & { [CHANNEL_KEY]?: Channel };

/**
 * The boot script and the app bundle are separate scripts, so module state cannot
 * be shared between them. They meet on this global object instead. Whichever runs
 * first creates it.
 */
export function getChannel(): Channel {
  const scope = globalThis as ChannelGlobal;
  scope[CHANNEL_KEY] ??= { policy: null, status: 'pending', frame: null, timeoutId: null };
  return scope[CHANNEL_KEY];
}

/** Test helper: forget everything the boot script or the app reported. */
export function resetChannel(): void {
  const channel = getChannel();
  if (channel.timeoutId !== null) clearTimeout(channel.timeoutId);
  delete (globalThis as ChannelGlobal)[CHANNEL_KEY];
}
