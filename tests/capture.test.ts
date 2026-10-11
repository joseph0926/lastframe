import { describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { capture, onCapture, startCapture } from '../src/capture';
import { getChannel } from '../src/channel';
import { setScope } from '../src/scope';
import { navigate, putRawFrame, readAllFrames, renderApp, startLiveApp } from './helpers';

describe('capture', () => {
  it('does nothing until the app calls ready()', async () => {
    await boot({ routes: ['/'] });
    renderApp('<main>Inbox</main>');

    expect(getChannel().status).toBe('pending');
    expect(await capture()).toBeNull();
    expect(await readAllFrames()).toEqual([]);
  });

  it('stores the root, the shell, and the styles of an allowed route', async () => {
    document.documentElement.className = 'dark';
    document.documentElement.setAttribute('onclick', 'alert(1)');
    document.head.innerHTML = '<style>.card { color: red; }</style>';
    await startLiveApp({ routes: ['/'], version: 'v2' }, '<main class="card">Inbox</main>');

    const captured = await capture();
    const [frame] = await readAllFrames();

    expect(captured).toMatchObject({ route: '/' });
    expect(frame).toMatchObject({
      key: '|/',
      route: '/',
      scope: null,
      version: 'v2',
      mask: 'none',
      html: '<div id="root"><main class="card">Inbox</main></div>',
    });
    expect(frame.shell.html.attrs).toEqual({ class: 'dark' });
    expect(frame.styles).toHaveLength(1);
  });

  it('keeps every top-level node of the root, not just the first one', async () => {
    await startLiveApp({ routes: ['/'] }, '<header>Top</header><main>Body</main>');

    await capture();
    const [frame] = await readAllFrames();

    expect(frame.html).toContain('<header>Top</header><main>Body</main>');
  });

  it('skips routes outside the policy', async () => {
    await startLiveApp({ routes: ['/inbox'] }, '<main>Home</main>');

    expect(await capture()).toBeNull();
  });

  it('keys frames by pattern match and scope', async () => {
    setScope('user-7');
    navigate('/projects/42');
    await startLiveApp({ routes: ['/projects/:id'] }, '<main>Project</main>');

    await capture();
    const [frame] = await readAllFrames();

    expect(frame).toMatchObject({ key: 'user-7|/projects/42', scope: 'user-7' });
  });

  it('removes excluded elements, password values, and event handlers', async () => {
    await startLiveApp(
      { routes: ['/'], exclude: ['.toast'] },
      '<div class="toast">Saved</div><div data-lastframe-exclude>Chat</div>' +
        '<input type="password" value="hunter2"><button onclick="pay()">Pay</button>',
    );

    await capture();
    const [frame] = await readAllFrames();

    expect(frame.html).not.toMatch(/Saved|Chat|hunter2|onclick/);
    expect(frame.html).toContain('<button>Pay</button>');
  });

  it('masks before storing, so the real text never reaches IndexedDB', async () => {
    await startLiveApp({ routes: ['/'], mask: true }, '<p>Jane Doe</p>');

    await capture();
    const [frame] = await readAllFrames();

    expect(frame.mask).toBe('all');
    expect(frame.html).not.toContain('Jane');
    expect(frame.html).toContain('data-lf-mask');
  });

  it('refuses frames over maxBytes', async () => {
    await startLiveApp({ routes: ['/'], maxBytes: 64 }, `<p>${'x'.repeat(200)}</p>`);

    expect(await capture()).toBeNull();
    expect(await readAllFrames()).toEqual([]);
  });

  it('omits styles when styles: false', async () => {
    document.head.innerHTML = '<style>.card { color: red; }</style>';
    await startLiveApp({ routes: ['/'], styles: false }, '<main>Inbox</main>');

    await capture();
    const [frame] = await readAllFrames();

    expect(frame.styles).toEqual([]);
    expect(frame.fonts).toEqual([]);
  });

  it('notifies listeners', async () => {
    const listener = vi.fn();
    const unsubscribe = onCapture(listener);
    await startLiveApp({ routes: ['/'] }, '<main>Inbox</main>');

    await capture();
    unsubscribe();
    await capture();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ route: '/' });
  });

  it('uses the element passed to ready() as the root', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await boot({ routes: ['/'] });
    getChannel().status = 'live';
    const app = document.getElementById('app')!;
    app.innerHTML = '<main>Vue app</main>';
    startCapture(app);

    await capture();
    const [frame] = await readAllFrames();

    expect(frame.html).toBe('<div id="app"><main>Vue app</main></div>');
  });
});

describe('automatic capture', () => {
  it('captures when the page becomes hidden', async () => {
    await startLiveApp({ routes: ['/'] }, '<main>Inbox</main>');
    const captured = new Promise((resolve) => onCapture(resolve));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    await expect(captured).resolves.toMatchObject({ route: '/' });
  });

  it('captures on pagehide', async () => {
    await startLiveApp({ routes: ['/'] }, '<main>Inbox</main>');
    const captured = new Promise((resolve) => onCapture(resolve));

    window.dispatchEvent(new Event('pagehide'));

    await expect(captured).resolves.toMatchObject({ route: '/' });
  });

  it('prunes frames the current policy would not show, then keeps the newest maxFrames', async () => {
    const shell = { html: { attrs: {}, style: '' }, body: { attrs: {}, style: '' } };
    const base = {
      scope: null,
      version: null,
      mask: 'none',
      html: '<p></p>',
      styles: [],
      fonts: [],
      shell,
    };
    const now = Date.now();
    await putRawFrame({ ...base, key: '|/a', route: '/a', capturedAt: now - 3000 });
    await putRawFrame({ ...base, key: '|/b', route: '/b', capturedAt: now - 2000 });
    await putRawFrame({ ...base, key: '|/c', route: '/c', capturedAt: now - 1000 });
    await putRawFrame({ ...base, key: '|/gone', route: '/gone', capturedAt: now });
    await putRawFrame({ ...base, key: 'other|/a', route: '/a', scope: 'other', capturedAt: now });
    await putRawFrame({ key: '|/broken', route: '/broken' });

    await startLiveApp({ routes: ['/a', '/b', '/c'], maxFrames: 2 }, '<main></main>');
    await vi.waitFor(async () => {
      expect((await readAllFrames()).map((frame) => frame.key).sort()).toEqual(['|/b', '|/c']);
    });
  });
});

describe('sign-out', () => {
  it('clearFrames() deletes every stored frame', async () => {
    const { clearFrames } = await import('../src/index');
    await startLiveApp({ routes: ['/'] }, '<main>Inbox</main>');
    await capture();

    await clearFrames();

    expect(await readAllFrames()).toEqual([]);
  });

  it('setScope(null) forgets the scope', () => {
    setScope('user-7');
    setScope(null);

    expect(window.localStorage.getItem('lastframe:scope')).toBeNull();
  });
});
