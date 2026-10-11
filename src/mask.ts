/**
 * Masking turns a frame into a skeleton of itself: the layout is kept, but text and
 * media are replaced before the frame is stored, so the real content never reaches
 * IndexedDB. Replacement characters keep roughly the original line lengths.
 */
export const MASK_ATTRIBUTE = 'data-lastframe-mask';
export const EXCLUDE_ATTRIBUTE = 'data-lastframe-exclude';
export const MASK_TEXT_MARK = 'data-lf-mask';
export const MASK_MEDIA_MARK = 'data-lf-mask-media';

const MEDIA_SELECTOR = 'img, video, canvas, picture, svg';
const SKIPPED_TEXT_PARENTS = new Set(['STYLE', 'SCRIPT', 'TEXTAREA', 'TITLE']);

export interface MediaSize {
  width: number;
  height: number;
}

/**
 * Sizes have to come from the live tree because a clone is not laid out. Both
 * trees have the same structure, so the n-th media element of one is the n-th of
 * the other.
 */
export function measureMedia(live: Element, clone: Element): Map<Element, MediaSize> {
  const sizes = new Map<Element, MediaSize>();
  const liveMedia = live.querySelectorAll(MEDIA_SELECTOR);
  const cloneMedia = clone.querySelectorAll(MEDIA_SELECTOR);
  if (liveMedia.length !== cloneMedia.length) return sizes;
  liveMedia.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    sizes.set(cloneMedia[index], { width: rect.width, height: rect.height });
  });
  return sizes;
}

function maskCharacter(character: string): string {
  if (/\s/.test(character)) return character;
  if (/[0-9]/.test(character)) return '0';
  if (/[A-Z]/.test(character)) return 'X';
  if (/[a-z]/.test(character)) return 'x';
  // Wide scripts (CJK, Hangul) keep their width with a single wide placeholder.
  if (character.charCodeAt(0) >= 0x1100) return '\u25a0';
  return '-';
}

export function maskText(text: string): string {
  return Array.from(text, maskCharacter).join('');
}

function isInsideSvg(node: Node): boolean {
  return node.parentElement?.closest('svg') != null;
}

function maskTextNodes(root: Element): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent || SKIPPED_TEXT_PARENTS.has(parent.tagName)) continue;
    if (!text.data.trim() || isInsideSvg(text)) continue;
    textNodes.push(text);
  }
  for (const text of textNodes) {
    const span = doc.createElement('span');
    span.setAttribute(MASK_TEXT_MARK, '');
    span.textContent = maskText(text.data);
    text.replaceWith(span);
  }
}

function maskMediaElement(element: Element, size: MediaSize | undefined): void {
  const doc = element.ownerDocument;
  const block = doc.createElement('span');
  block.setAttribute(MASK_MEDIA_MARK, '');
  const className = element.getAttribute('class');
  if (className) block.setAttribute('class', className);
  const style = element.getAttribute('style');
  if (style) block.setAttribute('style', style);
  if (size && size.width > 0 && size.height > 0) {
    block.style.width = `${Math.round(size.width)}px`;
    block.style.height = `${Math.round(size.height)}px`;
  }
  element.replaceWith(block);
}

function maskFormValues(root: Element): void {
  root.querySelectorAll('input, textarea, select').forEach((field) => {
    if (field.tagName === 'TEXTAREA') field.textContent = '';
    field.removeAttribute('value');
    field.removeAttribute('placeholder');
    field.querySelectorAll('option').forEach((option) => option.removeAttribute('selected'));
  });
}

const BACKGROUND_URL = /background(?:-image)?\s*:[^;]*url\([^)]*\)[^;]*;?/gi;

function maskSubtree(root: Element, sizes: Map<Element, MediaSize>): void {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    const style = element.getAttribute('style');
    if (style) element.setAttribute('style', style.replace(BACKGROUND_URL, ''));
    element.removeAttribute('title');
    element.removeAttribute('alt');
    element.removeAttribute('aria-label');
  }
  if (root.matches(MEDIA_SELECTOR)) {
    if (root.parentNode) maskMediaElement(root, sizes.get(root));
    return;
  }
  const media = Array.from(root.querySelectorAll(MEDIA_SELECTOR)).filter(
    (element) => !element.parentElement?.closest('svg'),
  );
  for (const element of media) maskMediaElement(element, sizes.get(element));
  maskTextNodes(root);
  maskFormValues(root);
}

/**
 * Applies the route's mask to a cloned tree in place. `mask: true` masks the whole
 * tree; a selector list masks the matching elements. `[data-lastframe-mask]`
 * always masks its element.
 */
export function applyMask(
  clone: Element,
  mask: boolean | string[],
  sizes: Map<Element, MediaSize>,
): void {
  if (mask === true) {
    maskSubtree(clone, sizes);
    return;
  }
  const selectors = [`[${MASK_ATTRIBUTE}]`, ...(mask === false ? [] : mask)];
  const targets = new Set<Element>();
  for (const selector of selectors) {
    try {
      if (clone.matches(selector)) targets.add(clone);
      clone.querySelectorAll(selector).forEach((element) => targets.add(element));
    } catch {
      // An invalid selector masks nothing rather than breaking capture.
    }
  }
  // Masking an ancestor already covers its descendants.
  for (const target of targets) {
    const coveredByAncestor = Array.from(targets).some(
      (other) => other !== target && other.contains(target),
    );
    if (!coveredByAncestor) maskSubtree(target, sizes);
  }
}

export function needsMediaSizes(clone: Element, mask: boolean | string[]): boolean {
  if (mask === true || (Array.isArray(mask) && mask.length > 0)) return true;
  return clone.querySelector(`[${MASK_ATTRIBUTE}]`) !== null;
}

export function removeExcluded(clone: Element, selectors: string[]): void {
  for (const selector of [`[${EXCLUDE_ATTRIBUTE}]`, ...selectors]) {
    try {
      clone.querySelectorAll(selector).forEach((element) => element.remove());
    } catch {}
  }
}
