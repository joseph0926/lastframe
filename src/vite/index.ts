import { posix } from 'node:path';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { validatePolicy, type LastframePolicy } from '../policy';
import { contentHash, loadBootScript, wrapBootScript } from '../build/boot-script';

export interface LastframeViteOptions extends LastframePolicy {
  /**
   * Inline the boot script into the HTML instead of emitting a file. Saves a
   * request on the first visit; needs a CSP hash or nonce under a strict CSP.
   * Default: `false`.
   */
  inline?: boolean;
  /** Where the boot script goes. It must run before the app bundle. Default: `'head-prepend'`. */
  injectTo?: 'head-prepend' | 'head';
  /** CSP nonce for the boot script tag. Static builds embed it at build time. */
  nonce?: string;
  /** Force development logs on or off. Default: on for `vite` (serve), off for builds. */
  debug?: boolean;
}

const NONCE_PATTERN = /^[A-Za-z0-9+/_-]+=*$/;
const DEV_SCRIPT_PATH = '@lastframe/boot.js';
const DELIVERY_OPTIONS = ['inline', 'injectTo', 'nonce', 'debug'] as const;

function validateNonce(nonce: string | undefined): string | undefined {
  const value = nonce?.trim();
  if (!value) return undefined;
  if (!NONCE_PATTERN.test(value)) {
    throw new Error('[lastframe] `nonce` may only contain base64 or base64url characters.');
  }
  return value;
}

function policyFrom(options: LastframeViteOptions): LastframePolicy {
  const policy: Record<string, unknown> = { ...options };
  for (const key of DELIVERY_OPTIONS) delete policy[key];
  return policy as unknown as LastframePolicy;
}

/** Relative `base` values need a path relative to each HTML page. */
function resolveScriptSrc(base: string, fileName: string, htmlPath: string): string {
  if (base.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(base)) return `${base}${fileName}`;
  const htmlDir = posix.dirname(htmlPath.startsWith('/') ? htmlPath : `/${htmlPath}`);
  const relative = posix.relative(htmlDir, `/${fileName}`);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/**
 * Vite plugin for Lastframe. Injects the boot script that paints the stored frame
 * before your bundle runs, and defines the flag that turns on development logs.
 *
 * @example
 * // vite.config.ts
 * import { lastframe } from 'lastframe/vite';
 * export default defineConfig({
 *   plugins: [react(), lastframe({ routes: ['/', '/inbox', '/projects/:id'] })],
 * });
 */
export function lastframe(options: LastframeViteOptions): Plugin {
  const { inline = false, injectTo = 'head-prepend' } = options;
  const policy = validatePolicy(policyFrom(options));
  const nonce = validateNonce(options.nonce);

  let isBuild = false;
  let dev = false;
  let base = '/';
  let assetsDir = 'assets';
  let script: string | null = null;
  let fileName = DEV_SCRIPT_PATH;

  return {
    name: 'lastframe',

    config(_config, env) {
      const devLogs = options.debug ?? env.command === 'serve';
      return { define: { __LASTFRAME_DEV__: JSON.stringify(devLogs) } };
    },

    configResolved(config) {
      isBuild = config.command === 'build';
      dev = options.debug ?? !isBuild;
      base = config.base || '/';
      assetsDir = config.build.assetsDir || 'assets';
    },

    async buildStart() {
      if (!policy) {
        this.warn('No routes configured, so Lastframe is disabled. Add `routes` to enable it.');
      }
      const code = await loadBootScript({ dev, minify: !dev });
      script = wrapBootScript(code, policy, { exposeDevFlag: dev && !isBuild });
      if (isBuild && !inline) {
        fileName = posix.join(assetsDir, `lastframe-${contentHash(script)}.js`);
        this.emitFile({ type: 'asset', fileName, source: script });
      }
    },

    transformIndexHtml: {
      order: 'post',
      handler(_html, context): HtmlTagDescriptor[] {
        if (!script || !policy) return [];
        const attrs: Record<string, string | boolean> = nonce ? { nonce } : {};
        if (inline) return [{ tag: 'script', attrs, children: script, injectTo }];
        const src = resolveScriptSrc(base, fileName, context.path);
        return [{ tag: 'script', attrs: { ...attrs, src }, injectTo }];
      },
    },

    configureServer(server) {
      if (inline) return;
      const path = `${base.startsWith('/') ? base : '/'}${DEV_SCRIPT_PATH}`;
      server.middlewares.use(path, (_request, response, next) => {
        if (!script) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(script);
      });
    },
  };
}

export default lastframe;
