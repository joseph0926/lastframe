import { startCapture } from './capture';
import { getChannel, type RestoredFrameInfo } from './channel';
import { debug } from './log';
import { isOverlayMounted, removeOverlay } from './overlay';

export interface ReadyOptions {
  /** Cross-fade from the frame to the live UI with the View Transitions API. Default: `true`. */
  transition?: boolean;
  /** The element the app renders into, when it is not the policy's `root` selector. */
  root?: Element | null;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function canTransition(): boolean {
  return (
    typeof document.startViewTransition === 'function' &&
    document.visibilityState !== 'hidden' &&
    !prefersReducedMotion()
  );
}

function removeWithTransition(): void {
  const transition = document.startViewTransition(removeOverlay);
  // A skipped or aborted transition (for example, the tab was hidden) rejects these
  // promises. The overlay must still go, and the rejection is not an app error.
  transition?.updateCallbackDone?.catch(removeOverlay);
  transition?.ready?.catch(() => {});
  transition?.finished?.catch(() => {});
}

/**
 * Tells Lastframe that the live UI is on screen. The painted frame is removed in
 * the same frame the live UI appears, and capturing starts for future visits.
 *
 * Call it once your real content has rendered, not when the first loading state
 * does: removing the frame early shows the user a skeleton after they already saw
 * the content. Calling it more than once is harmless.
 */
export function ready(options: ReadyOptions = {}): void {
  const { transition = true, root } = options;
  const channel = getChannel();
  const hadFrame = channel.status === 'restored';
  channel.status = 'live';
  if (channel.timeoutId !== null) {
    clearTimeout(channel.timeoutId);
    channel.timeoutId = null;
  }
  startCapture(root);

  if (!hadFrame || !isOverlayMounted()) return;
  if (channel.frame) debug(`Live after ${Date.now() - channel.frame.paintedAt} ms on the frame`);
  if (transition && canTransition()) {
    removeWithTransition();
  } else {
    removeOverlay();
  }
}

/** The frame painted at boot on this page load, or `null` when there was none. */
export function getRestoredFrame(): RestoredFrameInfo | null {
  return getChannel().frame;
}
