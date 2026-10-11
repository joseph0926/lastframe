/**
 * Frames are replayed only as an inert overlay, so the sanitizer removes what can
 * run code or load documents. Form controls stay so the frame matches the screen
 * the user saw; STRIPPED_ATTRIBUTES removes their navigation and submission paths.
 *
 * Restore happens on the boot path, so this is a small synchronous sanitizer with
 * no dependency. It covers the vectors listed here and is not a general-purpose
 * HTML sanitizer.
 */
const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
  'meta',
  'link',
  'base',
  'template',
  'noscript',
] as const;

/**
 * The overlay is inert, but that guarantee should not depend on CSS alone, since a
 * captured stylesheet could undo it. Removing targets at the attribute level means
 * a click has nowhere to go even if one reaches the frame.
 */
const STRIPPED_ATTRIBUTES = new Set([
  'href',
  'xlink:href',
  'action',
  'formaction',
  'method',
  'formmethod',
  'target',
  'formtarget',
  'autocomplete',
  'autofocus',
  'contenteditable',
  'srcdoc',
]);

const URL_ATTRIBUTES = new Set(['background', 'cite', 'poster', 'src']);

const RASTER_DATA_URL =
  /^data:image\/(?:png|jpeg|gif|webp|avif);base64,(?=[a-z0-9+/])((?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?)$/i;

function isUnsafeUrl(rawValue: string): boolean {
  const value = rawValue.trim();
  const separator = value.indexOf(':');
  if (separator < 0) return false;
  const scheme = value
    .slice(0, separator)
    .replace(/[\u0000- \u007f]+/g, '')
    .toLowerCase();
  if (scheme === 'javascript' || scheme === 'vbscript') return true;
  return scheme === 'data' && !RASTER_DATA_URL.test(value);
}

export function isEventHandlerAttribute(name: string): boolean {
  return name.toLowerCase().startsWith('on');
}

export function stripPointerEvents(style: string): string {
  return style
    .split(';')
    .filter((declaration) => {
      const property = declaration.slice(0, declaration.indexOf(':')).trim().toLowerCase();
      return property !== 'pointer-events';
    })
    .join(';');
}

function sanitizeElement(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (isEventHandlerAttribute(name) || STRIPPED_ATTRIBUTES.has(name)) {
      element.removeAttribute(attribute.name);
    } else if (name === 'style') {
      element.setAttribute(attribute.name, stripPointerEvents(attribute.value));
    } else if (URL_ATTRIBUTES.has(name) && isUnsafeUrl(attribute.value)) {
      element.removeAttribute(attribute.name);
    }
  }
}

export function sanitizeFrameHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.body) return '';
  for (const tag of FORBIDDEN_TAGS) {
    doc.body.querySelectorAll(tag).forEach((element) => element.remove());
  }
  doc.body.querySelectorAll('*').forEach(sanitizeElement);
  return doc.body.innerHTML;
}

const SHELL_ATTRIBUTE = /^(?:class|lang|dir|data-[\w-]+)$/i;

/** `<html>` and `<body>` attributes are copied onto overlay wrappers; only styling hooks pass. */
export function sanitizeShellAttributes(attrs: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === 'string' && SHELL_ATTRIBUTE.test(name)) result[name] = value;
  }
  return result;
}
