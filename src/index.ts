import { getChannel, type LastframeStatus } from './channel';
import { openDB, clearFrameStore } from './storage';

export { ready, getRestoredFrame } from './ready';
export { capture, onCapture, stopCapture } from './capture';
export { setScope } from './scope';
export { MASK_ATTRIBUTE, EXCLUDE_ATTRIBUTE } from './mask';

export type { ReadyOptions } from './ready';
export type { CapturedFrame } from './capture';
export type { LastframeStatus, RestoredFrameInfo } from './channel';
export type { LastframePolicy, MaskOption, RouteRule } from './policy';

/** Where Lastframe is on this page load. See {@link LastframeStatus}. */
export function getStatus(): LastframeStatus {
  return getChannel().status;
}

/**
 * Deletes every stored frame on this origin. Call it on sign-out together with
 * `setScope(null)`, so the next visitor never sees the previous user's screen.
 */
export async function clearFrames(): Promise<void> {
  const db = await openDB();
  try {
    await clearFrameStore(db);
  } finally {
    db.close();
  }
}
