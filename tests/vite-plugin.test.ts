import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HtmlTagDescriptor, IndexHtmlTransformContext, Plugin } from 'vite';

vi.mock('node:fs/promises', () => {
  // Stands in for the prebuilt boot script, which only exists after `pnpm build`.
  const readFile = vi.fn((path: string) => Promise.resolve(`/*${path.split('/').pop()}*/boot();`));
  return { readFile, default: { readFile } };
});

const { lastframe } = await import('../src/vite');

type Hook = (...args: unknown[]) => unknown;

interface Harness {
  plugin: Plugin;
  emitted: Array<{ fileName: string; source: string }>;
  warnings: string[];
  tags: (path?: string) => HtmlTagDescriptor[];
  define: () => Record<string, string>;
}

async function setup(
  plugin: Plugin,
  { command = 'build', base = '/' }: { command?: 'build' | 'serve'; base?: string } = {},
): Promise<Harness> {
  const emitted: Harness['emitted'] = [];
  const warnings: string[] = [];
  const config = (plugin.config as Hook)({}, { command, mode: 'production' }) as {
    define: Record<string, string>;
  };
  (plugin.configResolved as Hook)({
    command,
    base,
    build: { assetsDir: 'assets' },
  });
  await (plugin.buildStart as Hook).call(
    {
      emitFile: (file: { fileName: string; source: string }) => emitted.push(file),
      warn: (message: string) => warnings.push(message),
    },
    {},
  );
  const transform = plugin.transformIndexHtml as {
    handler: (html: string, context: IndexHtmlTransformContext) => HtmlTagDescriptor[];
  };
  return {
    plugin,
    emitted,
    warnings,
    tags: (path = '/index.html') =>
      transform.handler('<html></html>', { path } as IndexHtmlTransformContext),
    define: () => config.define,
  };
}

describe('lastframe() Vite plugin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates options when the config is loaded', () => {
    expect(() => lastframe({ routes: ['inbox'] })).toThrow('starts with `/`');
    expect(() => lastframe({ routes: ['/'], nonce: 'bad nonce"' })).toThrow('nonce');
  });

  it('emits a content-hashed boot script and links it at the top of <head>', async () => {
    const { emitted, tags } = await setup(lastframe({ routes: ['/', '/inbox'] }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toMatch(/^assets\/lastframe-[0-9a-f]{10}\.js$/);
    expect(emitted[0].source).toContain('boot.prod.min.iife.js');
    expect(emitted[0].source).toContain('"routes":[{"path":"/","mask":false}');
    expect(emitted[0].source).not.toContain('__LASTFRAME_DEV__=true');
    expect(tags()).toEqual([
      { tag: 'script', attrs: { src: `/${emitted[0].fileName}` }, injectTo: 'head-prepend' },
    ]);
  });

  it('builds relative script paths for a relative base', async () => {
    const { emitted, tags } = await setup(lastframe({ routes: ['/'] }), { base: './' });

    expect(tags('/index.html')[0].attrs?.src).toBe(`./${emitted[0].fileName}`);
    expect(tags('/nested/page.html')[0].attrs?.src).toBe(`../${emitted[0].fileName}`);
  });

  it('prefixes an absolute base', async () => {
    const { emitted, tags } = await setup(lastframe({ routes: ['/app/'] }), { base: '/app/' });

    expect(tags()[0].attrs?.src).toBe(`/app/${emitted[0].fileName}`);
  });

  it('inlines the script with a nonce when asked', async () => {
    const { emitted, tags } = await setup(
      lastframe({ routes: ['/'], inline: true, nonce: 'abc123==', injectTo: 'head' }),
    );

    expect(emitted).toEqual([]);
    const [tag] = tags();
    expect(tag).toMatchObject({ tag: 'script', attrs: { nonce: 'abc123==' }, injectTo: 'head' });
    expect(tag.children).toContain('boot();');
  });

  it('serves a development script with logs on the dev server', async () => {
    const plugin = lastframe({ routes: ['/'] });
    const { emitted, tags, define } = await setup(plugin, { command: 'serve' });
    const middlewares: Array<{ path: string; handler: Hook }> = [];
    (plugin.configureServer as Hook)({
      middlewares: { use: (path: string, handler: Hook) => middlewares.push({ path, handler }) },
    });

    const response = { setHeader: vi.fn(), end: vi.fn(), statusCode: 0 };
    middlewares[0].handler({}, response, vi.fn());

    expect(emitted).toEqual([]);
    expect(define()).toEqual({ __LASTFRAME_DEV__: 'true' });
    expect(middlewares[0].path).toBe('/@lastframe/boot.js');
    expect(tags()[0].attrs?.src).toBe('/@lastframe/boot.js');
    expect(response.end.mock.calls[0][0]).toContain('globalThis.__LASTFRAME_DEV__=true;');
    expect(response.end.mock.calls[0][0]).toContain('boot.dev.iife.js');
  });

  it('turns logs off in builds unless debug is set', async () => {
    expect((await setup(lastframe({ routes: ['/'] }))).define()).toEqual({
      __LASTFRAME_DEV__: 'false',
    });
    const debugBuild = await setup(lastframe({ routes: ['/'], debug: true }));
    expect(debugBuild.define()).toEqual({ __LASTFRAME_DEV__: 'true' });
    expect(debugBuild.emitted[0].source).toContain('boot.dev.iife.js');
  });

  it('warns and injects nothing without routes', async () => {
    const { tags, warnings } = await setup(lastframe({ routes: [] }));

    expect(tags()).toEqual([]);
    expect(warnings[0]).toContain('No routes configured');
  });
});
