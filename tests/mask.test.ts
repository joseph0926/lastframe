import { describe, expect, it } from 'vitest';
import { applyMask, maskText, measureMedia, removeExcluded } from '../src/mask';

function tree(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('maskText', () => {
  it('keeps whitespace and line length but not the content', () => {
    expect(maskText('Jane Doe, 42')).toBe('Xxxx Xxx- 00');
    expect(maskText('김영훈 님')).toBe('■■■ ■');
  });
});

describe('applyMask', () => {
  it('masks every text node and form value with mask: true', () => {
    const root = tree(
      '<h1 title="Jane">Hello Jane</h1><p>Balance <b>$1,204</b></p><input value="jane@example.com" placeholder="Email">',
    );

    applyMask(root, true, new Map());

    expect(root.textContent).not.toMatch(/Jane|1,204|Hello/);
    expect(root.querySelectorAll('[data-lf-mask]')).toHaveLength(3);
    expect(root.querySelector('h1')?.hasAttribute('title')).toBe(false);
    expect(root.querySelector('input')?.hasAttribute('value')).toBe(false);
    expect(root.querySelector('input')?.hasAttribute('placeholder')).toBe(false);
  });

  it('replaces media with sized blocks that keep their classes', () => {
    const root = tree('<img class="avatar" src="/me.png" alt="Jane">');
    const sizes = new Map([[root.querySelector('img')!, { width: 48.4, height: 48 }]]);

    applyMask(root, true, sizes);

    const block = root.querySelector('[data-lf-mask-media]') as HTMLElement;
    expect(root.querySelector('img')).toBeNull();
    expect(block.className).toBe('avatar');
    expect(block.style.width).toBe('48px');
    expect(block.style.height).toBe('48px');
    expect(root.innerHTML).not.toContain('me.png');
  });

  it('masks only matching elements with a selector list', () => {
    const root = tree('<p class="name">Jane</p><p class="label">Inbox</p>');

    applyMask(root, ['.name'], new Map());

    expect(root.querySelector('.name')?.textContent).toBe('Xxxx');
    expect(root.querySelector('.label')?.textContent).toBe('Inbox');
  });

  it('always honours data-lastframe-mask', () => {
    const root = tree('<p data-lastframe-mask>Secret 123</p><p>Public</p>');

    applyMask(root, false, new Map());

    expect(root.textContent).toBe('Xxxxxx 000Public');
  });

  it('masks a nested target once', () => {
    const root = tree('<section class="a"><p class="a">Jane</p></section>');

    applyMask(root, ['.a'], new Map());

    expect(root.querySelectorAll('[data-lf-mask]')).toHaveLength(1);
  });

  it('ignores invalid selectors', () => {
    const root = tree('<p>Jane</p>');

    expect(() => applyMask(root, ['p['], new Map())).not.toThrow();
    expect(root.textContent).toBe('Jane');
  });

  it('strips background image URLs inside masked regions', () => {
    const root = tree('<div style="color: red; background-image: url(/me.png);">x</div>');

    applyMask(root, true, new Map());

    expect(root.innerHTML).not.toContain('me.png');
    expect(root.innerHTML).toContain('color: red');
  });
});

describe('measureMedia', () => {
  it('pairs live media with their clones in document order', () => {
    const live = tree('<img id="a"><span><img id="b"></span>');
    document.body.appendChild(live);
    const clone = live.cloneNode(true) as Element;

    const sizes = measureMedia(live, clone);

    expect([...sizes.keys()].map((element) => element.id)).toEqual(['a', 'b']);
    expect([...sizes.keys()].every((element) => clone.contains(element))).toBe(true);
  });
});

describe('removeExcluded', () => {
  it('removes data-lastframe-exclude and policy selectors', () => {
    const root = tree(
      '<div data-lastframe-exclude>toast</div><dialog open>modal</dialog><p>kept</p>',
    );

    removeExcluded(root, ['dialog']);

    expect(root.innerHTML).toBe('<p>kept</p>');
  });
});
