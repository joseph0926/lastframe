# lastframe

## 0.1.0

### Minor Changes

- 6b27514: First release of Lastframe, the successor of `@firsttx/prepaint`.

  - Framework-agnostic core with `ready()`, plus `createRoot` and `useFrameReady` for React.
  - Vite 7 and 8 plugin with flat options, and `renderBootScript` for other bundlers.
  - Pattern routes (`/projects/:id`, `/docs/*`), per-route masking, `exclude`, `version`, `maxFrames`, and `timeout`.
  - Masking stores a skeleton instead of the real content; `setScope` and `clearFrames` keep frames per user.
  - CSS is captured through the CSSOM and `html`/`body` selectors keep working inside the overlay.
  - See docs/migration.md for the move from `@firsttx/prepaint`.
