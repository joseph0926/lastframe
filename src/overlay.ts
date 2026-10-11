import { BODY_MARK, HTML_MARK } from './css';
import type { Frame, FrameShellNode } from './frame';
import { MASK_MEDIA_MARK, MASK_TEXT_MARK } from './mask';
import { sanitizeFrameHTML, sanitizeShellAttributes } from './sanitize';

export const OVERLAY_ID = 'lastframe-overlay';
const FONTS_ID = 'lastframe-fonts';
/** Set on `<html>` while a frame is painted, as a styling hook for the app. */
export const RESTORED_ATTRIBUTE = 'data-lastframe';
/**
 * Set on the overlay's root wrapper. App CSS is captured with the frame, so a rule
 * such as `[data-lastframe-frame] .clock { opacity: 0.5 }` styles only the frame.
 */
export const FRAME_ATTRIBUTE = 'data-lastframe-frame';

const MASK_COLOR = 'var(--lastframe-mask-color, rgba(127, 127, 127, 0.18))';

/** Comes after captured CSS so overlay mechanics win over page rules. */
const BASE_CSS = `
[${HTML_MARK}] { position: absolute !important; inset: 0 !important; overflow: hidden !important; display: block !important; }
[${BODY_MARK}] { display: block !important; min-height: 100% !important; box-sizing: border-box; }
[${MASK_TEXT_MARK}] { color: transparent !important; background: ${MASK_COLOR} !important; border-radius: 0.35em; -webkit-box-decoration-break: clone; box-decoration-break: clone; animation: lastframe-pulse 1.6s ease-in-out infinite; }
[${MASK_MEDIA_MARK}] { display: inline-block; max-width: 100%; background: ${MASK_COLOR} !important; border-radius: 0.5em; animation: lastframe-pulse 1.6s ease-in-out infinite; }
*:has(> [${MASK_TEXT_MARK}]) { text-overflow: clip !important; }
@keyframes lastframe-pulse { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { [${MASK_TEXT_MARK}], [${MASK_MEDIA_MARK}] { animation: none; } }
`;

function createShellElement(node: FrameShellNode, mark: string): HTMLElement {
  const element = document.createElement('div');
  for (const [name, value] of Object.entries(sanitizeShellAttributes(node.attrs))) {
    element.setAttribute(name, value);
  }
  element.setAttribute(mark, '');
  if (typeof node.style === 'string') element.setAttribute('style', node.style);
  return element;
}

function appendStyle(parent: Node, css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  parent.appendChild(style);
}

/**
 * Paints a frame above the page. The frame lives in a shadow root outside the app's
 * container, so the app renders into an untouched element and the frame's duplicate
 * ids and classes never meet the app's selectors. Pointer events stop at the host:
 * nothing in the frame works, and nothing under it can be clicked by accident.
 */
export function mountOverlay(frame: Frame): boolean {
  if (!document.body || document.getElementById(OVERLAY_ID)) return false;

  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;pointer-events:auto;cursor:progress;contain:strict;overflow:hidden;';

  const shadow = host.attachShadow({ mode: 'open' });
  for (const style of frame.styles) {
    if (style?.type === 'inline' && typeof style.css === 'string') {
      appendStyle(shadow, style.css);
    } else if (style?.type === 'external' && typeof style.href === 'string') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = style.href;
      shadow.appendChild(link);
    }
  }
  appendStyle(shadow, BASE_CSS);

  const htmlShell = createShellElement(frame.shell.html, HTML_MARK);
  const bodyShell = createShellElement(frame.shell.body, BODY_MARK);
  bodyShell.innerHTML = sanitizeFrameHTML(frame.html);
  htmlShell.setAttribute('inert', '');
  htmlShell.setAttribute(FRAME_ATTRIBUTE, '');
  htmlShell.appendChild(bodyShell);
  shadow.appendChild(htmlShell);

  const fonts = frame.fonts.filter((font) => typeof font === 'string');
  if (fonts.length > 0 && document.head) {
    const fontStyle = document.createElement('style');
    fontStyle.id = FONTS_ID;
    fontStyle.setAttribute('data-lastframe', '');
    fontStyle.textContent = fonts.join('\n');
    document.head.appendChild(fontStyle);
  }

  document.body.appendChild(host);
  document.documentElement.setAttribute(RESTORED_ATTRIBUTE, 'restored');
  return true;
}

export function isOverlayMounted(): boolean {
  return document.getElementById(OVERLAY_ID) !== null;
}

export function removeOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(FONTS_ID)?.remove();
  document.documentElement.removeAttribute(RESTORED_ATTRIBUTE);
}
