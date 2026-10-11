# Migrating from `@firsttx/prepaint`

Lastframe is the successor of FirstTx Prepaint (last release `@firsttx/prepaint@0.15.1`). The idea is the same: replay the last visual state of a client-rendered page while the bundle loads. The package was renamed, the API was reshaped around an explicit `ready()` signal, and several gaps were closed.

## What changed and why

| Area                | FirstTx Prepaint                           | Lastframe                                                                           |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Package             | `@firsttx/prepaint`                        | `lastframe`                                                                         |
| Vite plugin         | `firstTx({ policy: { routes } })`          | `lastframe({ routes })`, options are flat                                           |
| React entry         | `createFirstTxRoot(container, <App />)`    | `createRoot(container).render(<App />)` from `lastframe/react`                      |
| Other frameworks    | not supported                              | `ready()` from `lastframe`                                                          |
| Handoff             | always on the first React commit           | first commit by default, or `waitForReady` + `useFrameReady()` for loading states   |
| Stuck overlay       | could stay up if the app never mounted     | removed after `timeout` (10 s by default)                                           |
| Boot and app race   | overlay could appear after the app mounted | the app's `ready()` cancels a boot that has not painted yet                         |
| Routes              | exact pathnames                            | exact pathnames plus `:param` and trailing `*` patterns                             |
| Captured DOM        | first child of `#root` only                | the whole root, including fragments and several top-level nodes                     |
| CSS capture         | `<style>` text and fetched stylesheets     | CSSOM, so CSS-in-JS `insertRule` styles are included and no refetch is needed       |
| `html` / `body` CSS | lost inside the shadow root                | rewritten to stand-in elements, so themes on `<html>` keep working                  |
| Privacy             | `data-firsttx-sensitive` cleared text      | `mask` option and `data-lastframe-mask` store a skeleton; `setScope`, `clearFrames` |
| Volatile content    | `data-firsttx-volatile` cleared text       | `data-lastframe-mask` (skeleton) or `data-lastframe-exclude` (removed)              |
| Deploys             | old UI replayed after a deploy             | `version` discards frames from another release                                      |
| Storage             | `firsttx-prepaint` database                | `lastframe` database; the old one is deleted on first run                           |
| Errors              | exported error classes                     | Lastframe never throws into your app; failures are logged in development            |

## Steps

1. Replace the package.

   ```bash
   npm uninstall @firsttx/prepaint
   npm install lastframe
   ```

2. Update the Vite config.

   ```diff
   - import { firstTx } from '@firsttx/prepaint/plugin/vite';
   + import { lastframe } from 'lastframe/vite';

     plugins: [
   -   firstTx({ policy: { routes: ['/dashboard'], ttlMs: 86400000, maxSnapshotBytes: 512000, includeStyles: true } }),
   +   lastframe({ routes: ['/dashboard'], ttl: 86400000, maxBytes: 512000, styles: true }),
     ],
   ```

   `overlay`, `overlayRoutes`, `minify`, and `devFlagOverride` are gone. Use `debug` to force logs on or off.

3. Update the entry point.

   ```diff
   - import { createFirstTxRoot } from '@firsttx/prepaint';
   - createFirstTxRoot(document.getElementById('root')!, <App />, { transition: true });
   + import { createRoot } from 'lastframe/react';
   + createRoot(document.getElementById('root')!, { transition: true }).render(<App />);
   ```

   `onCapture` moved to `onCapture(listener)` from `lastframe`. `onHandoff` is replaced by `getRestoredFrame()`, which returns the painted frame or `null`.

4. Rename data attributes.

   ```bash
   # review the changes before committing
   grep -rl 'data-firsttx-' src | xargs sed -i '' \
     -e 's/data-firsttx-sensitive/data-lastframe-mask/g' \
     -e 's/data-firsttx-volatile/data-lastframe-mask/g'
   ```

   Use `data-lastframe-exclude` instead where an element should not appear in the frame at all.

5. Replace globals, if you used them.

   - `window.__FIRSTTX_ROUTE_KEY__` becomes `window.__LASTFRAME_ROUTE__`.
   - `window.__FIRSTTX_SENSITIVE_SELECTORS__` becomes the `mask` option.

6. Expect one cold start per route after upgrading. Frames live in a new database, so each route needs one visit to record a frame.

The FirstTx Prepaint changelog is kept in [legacy/firsttx-prepaint-CHANGELOG.md](./legacy/firsttx-prepaint-CHANGELOG.md).
