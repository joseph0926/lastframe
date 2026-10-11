import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { lastframe } from 'lastframe/vite';
import { defineConfig } from 'vite';

// Served from GitHub Pages at /lastframe/, so routes include the base path.
const base = '/lastframe/';

export default defineConfig({
  base,
  plugins: [
    react(),
    lastframe({
      routes: [base, { path: `${base}masked/`, mask: ['.screen'] }],
      version: '1',
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        masked: resolve(import.meta.dirname, 'masked/index.html'),
      },
    },
  },
});
