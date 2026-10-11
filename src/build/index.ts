import { validatePolicy, type LastframePolicy } from '../policy';
import { loadBootScript, wrapBootScript } from './boot-script';

export interface RenderBootScriptOptions {
  /** Enables `[lastframe]` console logs in the boot script. Default: `false`. */
  dev?: boolean;
  /** Default: `true` unless `dev` is set. */
  minify?: boolean;
}

/**
 * Returns the boot script for a policy, for bundlers without a Lastframe plugin.
 * Place it in a classic `<script>` at the top of `<head>`, before the app bundle,
 * either inline or as a file. Invalid options throw, so mistakes fail the build.
 *
 * @example
 * import { renderBootScript } from 'lastframe/build';
 * const code = await renderBootScript({ routes: ['/', '/inbox'] });
 * html = html.replace('<head>', () => `<head><script>${code}</script>`);
 */
export async function renderBootScript(
  policy: LastframePolicy,
  options: RenderBootScriptOptions = {},
): Promise<string> {
  const resolved = validatePolicy(policy);
  const dev = options.dev ?? false;
  const code = await loadBootScript({ dev, minify: options.minify ?? !dev });
  return wrapBootScript(code, resolved);
}

export type { LastframePolicy, MaskOption, RouteRule } from '../policy';
