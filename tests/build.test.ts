import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import * as core from '../src/index';
import * as react from '../src/react';

vi.mock('node:fs/promises', () => {
  // Stands in for the prebuilt boot script, which only exists after `pnpm build`.
  const readFile = vi.fn((path: string) => Promise.resolve(`/*${path.split('/').pop()}*/boot();`));
  return { readFile, default: { readFile } };
});

const { renderBootScript } = await import('../src/build');
const { wrapBootScript } = await import('../src/build/boot-script');

describe('renderBootScript', () => {
  it('returns a minified production script by default', async () => {
    const code = await renderBootScript({ routes: ['/'] });

    expect(code).toContain('boot.prod.min.iife.js');
    expect(code).toMatch(/^\(function\(__LASTFRAME_POLICY__\)\{try\{/);
    expect(code).toContain('"routes":[{"path":"/","mask":false}]');
  });

  it('can render the development variant', async () => {
    expect(await renderBootScript({ routes: ['/'] }, { dev: true })).toContain('boot.dev.iife.js');
  });

  it('throws on invalid options', async () => {
    await expect(renderBootScript({ routes: ['nope'] })).rejects.toThrow('Invalid options');
  });
});

describe('wrapBootScript', () => {
  it('passes the policy as a parameter and runs the real boot script against it', async () => {
    const executed = vi.fn();
    const code = wrapBootScript('run(__LASTFRAME_POLICY__); // trailing comment', {
      ...(await import('../src/policy')).validatePolicy({ routes: ['/'] })!,
    });

    runInNewContext(code, { run: executed, globalThis: {} });

    expect(executed).toHaveBeenCalledWith(
      expect.objectContaining({ routes: [{ path: '/', mask: false }] }),
    );
  });
});

describe('public surface', () => {
  it('exports the documented core API', () => {
    expect(Object.keys(core).sort()).toEqual([
      'EXCLUDE_ATTRIBUTE',
      'MASK_ATTRIBUTE',
      'capture',
      'clearFrames',
      'getRestoredFrame',
      'getStatus',
      'onCapture',
      'ready',
      'setScope',
      'stopCapture',
    ]);
  });

  it('exports the documented React API', () => {
    expect(Object.keys(react).sort()).toEqual(['createRoot', 'useFrameReady']);
  });
});
