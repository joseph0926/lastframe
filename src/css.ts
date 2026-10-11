import type { FrameStyle } from './frame';

/**
 * The frame is painted inside a shadow root, where selectors cannot reach the real
 * `<html>` and `<body>`. The overlay rebuilds both as wrapper elements carrying
 * these attributes, and captured selectors are rewritten to target them, so rules
 * such as `:root { --brand: … }` or `html.dark .card` keep working.
 */
export const HTML_MARK = 'data-lf-html';
export const BODY_MARK = 'data-lf-body';

const OWN_STYLE_MARK = 'data-lastframe';

const SELECTOR_BOUNDARY_BEFORE = '(^|[\\s>+~,(])';
const SELECTOR_BOUNDARY_AFTER = '(?=$|[\\s.#:[>+~,)])';
const ROOT_PATTERN = new RegExp(
  `${SELECTOR_BOUNDARY_BEFORE}(?:html)?:root${SELECTOR_BOUNDARY_AFTER}`,
  'gi',
);
const HTML_PATTERN = new RegExp(`${SELECTOR_BOUNDARY_BEFORE}html${SELECTOR_BOUNDARY_AFTER}`, 'gi');
const BODY_PATTERN = new RegExp(`${SELECTOR_BOUNDARY_BEFORE}body${SELECTOR_BOUNDARY_AFTER}`, 'gi');

export function rewriteSelector(selector: string): string {
  return selector
    .replace(ROOT_PATTERN, `$1[${HTML_MARK}]`)
    .replace(HTML_PATTERN, `$1[${HTML_MARK}]`)
    .replace(BODY_PATTERN, `$1[${BODY_MARK}]`);
}

interface CollectedCss {
  css: string;
  fonts: string[];
}

type RuleLike = CSSRule & {
  selectorText?: string;
  cssRules?: CSSRuleList;
  styleSheet?: CSSStyleSheet | null;
};

// jsdom and older engines do not expose every CSSOM constructor, so rules are
// recognised by their `type` constant instead of `instanceof`.
const STYLE_RULE = 1;
const IMPORT_RULE = 3;
const FONT_FACE_RULE = 5;

function serializeRules(rules: CSSRuleList, collected: CollectedCss): string {
  let css = '';
  for (const rule of Array.from(rules) as RuleLike[]) {
    if (rule.type === FONT_FACE_RULE) {
      // @font-face does not apply inside shadow roots in every engine, so fonts are
      // installed on the document while the frame is visible.
      collected.fonts.push(rule.cssText);
      continue;
    }
    if (rule.type === IMPORT_RULE) {
      const imported = rule.styleSheet ? readSheetRules(rule.styleSheet) : null;
      if (imported) css += serializeRules(imported, collected);
      continue;
    }
    const text = rule.cssText;
    const open = text.indexOf('{');
    if (rule.type === STYLE_RULE && typeof rule.selectorText === 'string' && open > 0) {
      css += `${rewriteSelector(rule.selectorText)} ${text.slice(open)}\n`;
      continue;
    }
    if (rule.cssRules && open > 0) {
      // Grouping rules (@media, @supports, @layer, @container) keep their prelude.
      css += `${text.slice(0, open)}{\n${serializeRules(rule.cssRules, collected)}}\n`;
      continue;
    }
    css += `${text}\n`;
  }
  return css;
}

function readSheetRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    // Cross-origin stylesheets do not expose their rules.
    return null;
  }
}

function sheetMedia(sheet: CSSStyleSheet): string {
  const media = sheet.media?.mediaText?.trim();
  return media && media !== 'all' ? media : '';
}

/**
 * Reads styles through the CSSOM instead of `<style>` text, so rules inserted with
 * `insertRule` (CSS-in-JS libraries in production mode) are captured too, and
 * same-origin stylesheets need no extra network request.
 */
export function collectStyles(doc: Document = document): { styles: FrameStyle[]; fonts: string[] } {
  const styles: FrameStyle[] = [];
  const collected: CollectedCss = { css: '', fonts: [] };

  for (const sheet of Array.from(doc.styleSheets)) {
    const owner = sheet.ownerNode;
    if (owner instanceof Element && owner.hasAttribute(OWN_STYLE_MARK)) continue;
    if (sheet.disabled) continue;

    const rules = readSheetRules(sheet);
    if (!rules) {
      if (sheet.href) styles.push({ type: 'external', href: sheet.href });
      continue;
    }

    const body = serializeRules(rules, collected);
    if (!body.trim()) continue;
    const media = sheetMedia(sheet);
    styles.push({ type: 'inline', css: media ? `@media ${media} {\n${body}}\n` : body });
  }

  return { styles, fonts: collected.fonts };
}
