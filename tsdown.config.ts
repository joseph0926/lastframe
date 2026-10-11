import { defineConfig, type UserConfig } from 'tsdown';

// The boot script is prebuilt per variant so apps never bundle it with their own
// toolchain. Keep the file names in sync with src/build/boot-script.ts.
const bootVariants = [
  { name: 'boot.dev', dev: true, minify: false },
  { name: 'boot.dev.min', dev: true, minify: true },
  { name: 'boot.prod', dev: false, minify: false },
  { name: 'boot.prod.min', dev: false, minify: true },
];

const bootBuilds: UserConfig[] = bootVariants.map((variant) => ({
  entry: { [variant.name]: 'src/boot-script.ts' },
  outDir: 'dist/boot',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: variant.minify,
  dts: false,
  clean: false,
  sourcemap: false,
  define: { __LASTFRAME_DEV__: JSON.stringify(variant.dev) },
}));

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      react: 'src/react/index.tsx',
      vite: 'src/vite/index.ts',
      build: 'src/build/index.ts',
    },
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    dts: true,
    clean: true,
    sourcemap: true,
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    deps: { neverBundle: ['react', 'react-dom', 'react-dom/client', 'vite', /^node:/] },
  },
  ...bootBuilds,
]);
