import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializePolicy, type ResolvedPolicy } from '../policy';

export interface BootVariant {
  /** Enables `[lastframe]` console logs. */
  dev: boolean;
  minify: boolean;
}

/**
 * The boot script is prebuilt in four variants when the package is built (see
 * tsdown.config.ts), so apps never bundle it with their own toolchain and the
 * plugin works on any Vite version. Keep the file names in sync with the config.
 */
export function bootScriptPath({ dev, minify }: BootVariant): string {
  const name = `boot.${dev ? 'dev' : 'prod'}${minify ? '.min' : ''}.iife.js`;
  // Built chunks sit directly in dist/, next to dist/boot/.
  return join(dirname(fileURLToPath(import.meta.url)), 'boot', name);
}

export async function loadBootScript(variant: BootVariant): Promise<string> {
  try {
    return await readFile(bootScriptPath(variant), 'utf8');
  } catch (error) {
    throw new Error(
      `[lastframe] The prebuilt boot script is missing from the package (${bootScriptPath(variant)}). Reinstall lastframe.`,
      { cause: error },
    );
  }
}

/**
 * Wraps the prebuilt IIFE so it receives the policy as a parameter. `exposeDevFlag`
 * is for the Vite dev server only: pre-bundled dependencies there miss the static
 * `define`, and the boot script runs before them, so it sets the flag as a global.
 */
export function wrapBootScript(
  code: string,
  policy: ResolvedPolicy | null,
  { exposeDevFlag = false }: { exposeDevFlag?: boolean } = {},
): string {
  const devFlag = exposeDevFlag ? 'globalThis.__LASTFRAME_DEV__=true;' : '';
  return `${devFlag}(function(__LASTFRAME_POLICY__){try{${code.trim()}\n}catch(e){}})(${serializePolicy(policy)});\n`;
}

export function contentHash(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 10);
}
