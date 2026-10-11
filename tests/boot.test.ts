import { describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { capture } from '../src/capture';
import { getChannel } from '../src/channel';
import type { LastframePolicy } from '../src/policy';
import { getRestoredFrame, ready } from '../src/ready';
import { setScope } from '../src/scope';
import { navigate, overlayShadow, putRawFrame, reload, startLiveApp } from './helpers';

/** First visit captures a frame; the returned page state is the revisit before boot. */
async function visitThenReload(policy: LastframePolicy, html: string): Promise<void> {
  await startLiveApp(policy, html);
  expect(await capture()).not.toBeNull();
  await reload();
}

describe('boot on a revisit', () => {
  it('paints the stored frame in a shadow root outside the app container', async () => {
    document.head.innerHTML =
      '<style>:root { --brand: red; } .card { color: var(--brand); }</style>';
    await visitThenReload({ routes: ['/'] }, '<main class="card">Inbox</main>');

    await boot({ routes: ['/'] });

    const shadow = overlayShadow();
    expect(shadow?.querySelector('[data-lf-body] main.card')?.textContent).toBe('Inbox');
    expect(shadow?.innerHTML).toContain('[data-lf-html] {');
    expect(document.getElementById('root')?.innerHTML).toBe('');
    expect(document.documentElement.getAttribute('data-lastframe')).toBe('restored');
    expect(getChannel().status).toBe('restored');
    expect(getRestoredFrame()).toMatchObject({ route: '/' });
  });

  it('keeps the overlay inert and hidden from assistive technology', async () => {
    await visitThenReload({ routes: ['/'] }, '<button>Pay</button>');

    await boot({ routes: ['/'] });

    const host = document.getElementById('lastframe-overlay')!;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.style.pointerEvents).toBe('auto');
    expect(overlayShadow()?.querySelector('[data-lf-html]')?.hasAttribute('inert')).toBe(true);
  });

  it('marks the frame so app CSS can style it differently', async () => {
    document.head.innerHTML =
      '<style>.badge { display: none; } [data-lastframe-frame] .badge { display: inline; }</style>';
    await visitThenReload({ routes: ['/'] }, '<span class="badge">Frame</span>');

    await boot({ routes: ['/'] });

    const shadow = overlayShadow()!;
    expect(shadow.querySelector('[data-lastframe-frame] .badge')).not.toBeNull();
    expect(shadow.innerHTML).toContain('[data-lastframe-frame] .badge');
  });

  it('does nothing for routes outside the policy', async () => {
    await visitThenReload({ routes: ['/', '/inbox'] }, '<main>Home</main>');
    navigate('/inbox');

    await boot({ routes: ['/', '/inbox'] });

    expect(overlayShadow()).toBeNull();
    expect(getChannel().status).toBe('pending');
  });

  it('does nothing without a policy', async () => {
    await boot(undefined);

    expect(getChannel()).toMatchObject({ status: 'pending', policy: null });
  });

  it('does not paint a frame captured for another scope', async () => {
    setScope('alice');
    await visitThenReload({ routes: ['/'] }, '<main>Alice inbox</main>');
    setScope('bob');

    await boot({ routes: ['/'] });

    expect(overlayShadow()).toBeNull();
  });

  it('does not paint a frame from another version', async () => {
    await visitThenReload({ routes: ['/'], version: '1' }, '<main>Old UI</main>');

    await boot({ routes: ['/'], version: '2' });

    expect(overlayShadow()).toBeNull();
  });

  it('does not paint an unmasked frame on a route that now requires masking', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Jane</main>');

    await boot({ routes: ['/'], mask: true });

    expect(overlayShadow()).toBeNull();
  });

  it('does not paint an expired frame', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);

    await boot({ routes: ['/'] });

    expect(overlayShadow()).toBeNull();
  });

  it('ignores records that are not frames', async () => {
    await putRawFrame({ key: '|/', route: '/', html: '<img src=x onerror=alert(1)>' });

    await boot({ routes: ['/'] });

    expect(overlayShadow()).toBeNull();
    expect(getChannel().status).toBe('pending');
  });

  it('sanitizes stored HTML before painting it', async () => {
    const shell = {
      html: { attrs: { onclick: 'x()' }, style: '' },
      body: { attrs: {}, style: '' },
    };
    await putRawFrame({
      key: '|/',
      route: '/',
      scope: null,
      version: null,
      mask: 'none',
      html: '<div><img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:x()">a</a></div>',
      shell,
      styles: [],
      fonts: [],
      capturedAt: Date.now(),
    });

    await boot({ routes: ['/'] });

    const markup = overlayShadow()?.innerHTML ?? '';
    expect(markup).toContain('<img src="x">');
    expect(markup).not.toMatch(/onerror|<script|javascript:|onclick/);
  });

  it('waits for <body> when storage answers before the parser reaches it', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    const body = document.body;
    body.remove();

    await boot({ routes: ['/'] });
    expect(document.getElementById('lastframe-overlay')).toBeNull();

    document.documentElement.appendChild(body);
    await vi.waitFor(() => expect(overlayShadow()).not.toBeNull());
  });
});

describe('ready()', () => {
  it('removes the frame and makes the app live', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    await boot({ routes: ['/'] });

    ready({ transition: false });

    expect(overlayShadow()).toBeNull();
    expect(document.documentElement.hasAttribute('data-lastframe')).toBe(false);
    expect(getChannel().status).toBe('live');
    expect(getRestoredFrame()).not.toBeNull();
  });

  it('uses a view transition when available', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    await boot({ routes: ['/'] });
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return {
        updateCallbackDone: Promise.resolve(),
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      };
    });
    Object.assign(document, { startViewTransition });

    ready();

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(overlayShadow()).toBeNull();
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('still removes the frame when the browser aborts the transition', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    await boot({ routes: ['/'] });
    const aborted = () => Promise.reject(new DOMException('aborted', 'InvalidStateError'));
    Object.assign(document, {
      startViewTransition: () => ({
        updateCallbackDone: aborted(),
        ready: aborted(),
        finished: aborted(),
      }),
    });

    ready();

    await vi.waitFor(() => expect(overlayShadow()).toBeNull());
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('skips the transition for users who prefer reduced motion', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    await boot({ routes: ['/'] });
    const startViewTransition = vi.fn((update: () => void) => update());
    Object.assign(document, { startViewTransition });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));

    ready();

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(overlayShadow()).toBeNull();
    Reflect.deleteProperty(document, 'startViewTransition');
    vi.unstubAllGlobals();
  });

  it('wins the race when the app is ready before storage answers', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');

    const booting = boot({ routes: ['/'] });
    ready({ transition: false });
    await booting;

    expect(overlayShadow()).toBeNull();
    expect(getChannel().status).toBe('live');
  });

  it('is harmless to call twice', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    await boot({ routes: ['/'] });

    ready({ transition: false });
    expect(() => ready({ transition: false })).not.toThrow();
  });
});

describe('timeout', () => {
  it('removes the frame when ready() never comes', async () => {
    await visitThenReload({ routes: ['/'], timeout: 5000 }, '<main>Inbox</main>');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    await boot({ routes: ['/'], timeout: 5000 });
    expect(overlayShadow()).not.toBeNull();

    vi.advanceTimersByTime(4999);
    expect(overlayShadow()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(overlayShadow()).toBeNull();
    expect(getChannel().status).toBe('restored');
  });

  it('is cancelled by ready()', async () => {
    await visitThenReload({ routes: ['/'] }, '<main>Inbox</main>');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    await boot({ routes: ['/'] });
    ready({ transition: false });

    expect(getChannel().timeoutId).toBeNull();
  });
});

describe('masked frames', () => {
  it('replays the layout as a skeleton', async () => {
    await visitThenReload({ routes: ['/'], mask: true }, '<h1>Hello Jane</h1>');

    await boot({ routes: ['/'], mask: true });

    const shadow = overlayShadow();
    expect(shadow?.querySelector('h1 [data-lf-mask]')?.textContent).toBe('Xxxxx Xxxx');
    expect(shadow?.innerHTML).not.toContain('Jane');
  });
});
