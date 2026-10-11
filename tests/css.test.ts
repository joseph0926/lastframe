import { describe, expect, it } from 'vitest';
import { collectStyles, rewriteSelector } from '../src/css';

describe('rewriteSelector', () => {
  it.each([
    [':root', '[data-lf-html]'],
    ['html', '[data-lf-html]'],
    ['html:root', '[data-lf-html]'],
    ['body', '[data-lf-body]'],
    ['html.dark .card', '[data-lf-html].dark .card'],
    [
      'html[data-theme="dark"] body > main',
      '[data-lf-html][data-theme="dark"] [data-lf-body] > main',
    ],
    [':is(html, body) a', ':is([data-lf-html], [data-lf-body]) a'],
    ['.html-content, .body', '.html-content, .body'],
    ['[data-html] tbody', '[data-html] tbody'],
  ])('rewrites %s', (input, expected) => {
    expect(rewriteSelector(input)).toBe(expected);
  });
});

function addStyle(css: string, attributes: Record<string, string> = {}): HTMLStyleElement {
  const style = document.createElement('style');
  for (const [name, value] of Object.entries(attributes)) style.setAttribute(name, value);
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

describe('collectStyles', () => {
  it('reads rules from the CSSOM, including inserted ones', () => {
    const style = addStyle('body { margin: 0; }');
    style.sheet!.insertRule('.card { color: red; }', 1);

    const { styles } = collectStyles();

    expect(styles).toHaveLength(1);
    const css = styles[0].type === 'inline' ? styles[0].css : '';
    expect(css).toContain('[data-lf-body] {');
    expect(css).toContain('.card {');
  });

  it('keeps grouping rules and rewrites the selectors inside them', () => {
    addStyle('@media (min-width: 600px) { html { font-size: 18px; } }');

    const { styles } = collectStyles();
    const css = styles[0].type === 'inline' ? styles[0].css : '';

    expect(css).toMatch(/@media \(min-width: 600px\)\s*\{/);
    expect(css).toContain('[data-lf-html] {');
  });

  it('moves @font-face rules out so they can be installed on the document', () => {
    addStyle('@font-face { font-family: Brand; src: url(/brand.woff2); } p { color: blue; }');

    const { styles, fonts } = collectStyles();

    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toContain('Brand');
    expect(styles[0].type === 'inline' && styles[0].css).not.toContain('@font-face');
  });

  it('skips its own style elements', () => {
    addStyle('p { color: blue; }', { 'data-lastframe': '' });

    expect(collectStyles().styles).toEqual([]);
  });
});
