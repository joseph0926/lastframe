# @firsttx/prepaint

## 0.15.1

### Patch Changes

- 8cadc0a: Make development logs from the app-side runtime work and strip them from production bundles. The Vite plugin only defined `__FIRSTTX_DEV__` for the boot script, so the handoff and capture modules inside the app bundle never saw it: their development logs did not print in dev, and their log strings stayed in production bundles. The plugin now adds a `define` for the app bundle through the `config` hook, using the same rule as the boot script (`devFlagOverride`, otherwise `mode === 'development'`). Because Vite does not apply custom `define` values to pre-bundled dependencies on the dev server, the dev server boot script also sets `globalThis.__FIRSTTX_DEV__` before the app's module scripts run. You no longer need to declare `__FIRSTTX_DEV__` yourself.

## 0.15.0

### Minor Changes

- c7dfac0: Support Vite 8 and ship the boot script prebuilt. The Vite plugin used to bundle the boot script with esbuild during the host app's build, which tied it to an esbuild peer dependency that Vite 8 no longer brings in. The package now builds four boot script variants (development or production, minified or not) at publish time, and the plugin reads the matching one. The `vite` peer range is now `^7.0.0 || ^8.0.0`, and the optional `esbuild` peer dependency is removed. Plugin options and the emitted `firsttx-boot.js` asset are unchanged.

## 0.14.0

### Minor Changes

- 0f76800: Remove the DevTools bridge and stop depending on `@firsttx/shared`. Capture, restore, handoff, and storage errors no longer emit events to `window.__FIRSTTX_DEVTOOLS__`. `PrepaintError` keeps its public shape (`domain`, `code`, `timestamp`, `context`, `toJSON()`) but no longer extends the shared base class.

## 0.13.1

### Patch Changes

- d2be580: Remove the unreachable DOMPurify sanitize path and its helpers. `sanitizeSnapshotHTML`, `safeSetInnerHTML`, and `safeSetInnerHTMLSync` were never exported from the package entry and had no callers, so the optional `dompurify` import could not run. Restore has always used the synchronous built-in sanitizer. Documentation that pointed at `safeSetInnerHTML` and at a `@firsttx/prepaint/boot` subpath — neither of which the package exposes — is corrected.

## 0.13.0

### Minor Changes

- 13efc73: Keep form controls in the restored overlay so a revisit shows the screen the user actually left, and cut the interaction paths instead of the elements: `href`, `xlink:href`, form submission attributes (`action`, `formaction`, `method`, `formmethod`, `target`, `formtarget`), `autocomplete`, and inline `pointer-events` declarations are now stripped from every snapshot. Snapshot sanitization now removes only tags that execute code or load remote resources.

## 0.12.1

### Patch Changes

- b56b857: Restrict sanitized data URLs to valid base64 PNG, JPEG, GIF, WebP, and AVIF images, and block obfuscated JavaScript and VBScript URL schemes.
- Updated dependencies [b56b857]
  - @firsttx/shared@0.3.2

## 0.12.0

### Minor Changes

- e1594b3: Require an explicit route policy for snapshot capture and restore, add configurable TTL, payload-size, and CSS limits, migrate storage to schema v2, and emit an external self-starting Vite boot asset by default.

## Unreleased

### Minor Changes

- Add an explicit opt-in `policy` shared by capture, restore, and pruning. Missing or empty routes now disable Prepaint; defaults are a 7-day TTL, a 1 MiB UTF-8 payload limit, and CSS capture enabled.
- Emit a self-starting `/firsttx-boot.js` asset by default. `inline: true` remains available for static deployments that manage a CSP hash.
- Upgrade snapshot storage to schema v2, clearing legacy records once and pruning disallowed, expired, oversized, or style-ineligible records on boot.
- Prepare snapshots during idle time and save on `visibilitychange`/`pagehide` without a `beforeunload` listener.

## 0.11.0

### Minor Changes

- cf16bb6: Replace legacy cached-DOM hydration with a visual-only overlay handoff. Snapshot restore now leaves the React container untouched, React always mounts with `createRoot()`, and the overlay is removed after the first React commit.

  The `overlay`, `overlayRoutes`, and `onHydrationError` options remain accepted as deprecated no-ops for one release. Remove overlay flags from new integrations. `setupCapture({ routes })` can restrict new captures; restore-side route filtering is not available in this release.

## 0.10.0

### Minor Changes

- feat(prepaint): support safe re-initialization with lifecycle cleanup and updatable capture options

## 0.9.3

### Patch Changes

- Fix a background revalidation race where stale network responses could overwrite newer local patches. The sync manager now drops stale revalidation writes and adds a regression test. / Improve prepaint hot-path performance by switching dangerous-attribute stripping to a single-pass scan. Harden the Vite plugin by trimming and validating nonce values, rejecting unsafe input with tests.

## 0.9.2

### Patch Changes

- update version
- Updated dependencies
  - @firsttx/shared@0.3.1

## 0.9.1

### Patch Changes

- feat(prepaint): add comprehensive tests and improve documentation

## 0.9.0

### Changed

- All error classes (`PrepaintError`, `BootError`, `CaptureError`, `HydrationError`, `PrepaintStorageError`) now inherit from `BaseFirstTxError`
- Each error now has a `domain` property set to `'prepaint'`
- Each error now has a structured `code` property (e.g., `'BOOT_DOM_RESTORE'`, `'CAPTURE_DB_WRITE'`, `'STORAGE_QUOTA_EXCEEDED'`)
- `PrepaintStorageError.code` property renamed to `storageCode`; new `code` property returns prefixed codes

### Removed

- Duplicate `DANGEROUS_ATTRS` constant in `capture.ts` (now uses `DANGEROUS_ATTRIBUTES` from @firsttx/shared)
- Duplicate `DANGEROUS_ATTRIBUTES` and `DANGEROUS_HTML_TAGS` constants in `sanitize.ts` (now imported from @firsttx/shared)

### Added

- `PrepaintErrorCode` type for type-safe error code handling

## 0.8.1

### Patch Changes

### Bug Fixes

- **prepaint**: Add `'use no memo'` directive to `createFirstTxRoot` to prevent "Invalid hook call" errors when used with React Compiler (`babel-plugin-react-compiler`). The compiler was injecting `useMemoCache` hooks into internal callbacks, causing crashes since the function executes outside React's rendering context.

## 0.8.0

### Minor Changes

Fixed "Invalid hook call" error caused by bundling React into the package. Added explicit external config in tsup for react, react-dom, react/jsx-runtime, and react/jsx-dev-runtime to ensure the host app's React instance is used.

## 0.7.4

### Patch Changes

- Updated dependencies
  - @firsttx/shared@0.2.3

## 0.7.3

### Patch Changes

- Updated dependencies
  - @firsttx/shared@0.2.2

## 0.7.2

### Patch Changes

- Updated dependencies
  - @firsttx/shared@0.2.1

## 0.7.1

### Patch Changes

- update dependencies @firsttx/shared

## 0.7.0

### Minor Changes

### Features

- Add HTML sanitization for XSS protection in `boot.ts` and `overlay.ts`
- Support optional DOMPurify integration with fallback sanitizer

### Dependencies

- Add `@firsttx/shared` as dependency
- Add `dompurify` as optional peer dependency

## 0.6.1

### Patch Changes

- Widen React peer dependency range from `^19.2.1` to `^19.0.0` for broader compatibility with React 19.x users

## 0.6.0

### Minor Changes

- Fix timeout handling so long-running steps and retries are aborted with proper errors. & Add storageKey option to avoid IndexedDB key collisions and apply user-defined merge when replacing data. & Add route-key override and sensitive-field scrubbing to snapshot capture; make capture tests memory/Offline-friendly.

## 0.6.0

### Minor Changes

Add route-key override and sensitive-field scrubbing to snapshot capture; make capture tests memory/Offline-friendly.

## 0.5.0

### Minor Changes

- **Security**: Added XSS protection by removing 30 dangerous event handler attributes (onclick, onerror, onload, etc.) during DOM serialization to prevent malicious code execution on snapshot restore
- **Performance**: Optimized stylesheet collection with parallel fetching, reducing load time by ~80% for pages with multiple same-origin stylesheets
- **Reliability**: Improved error recovery with automatic cleanup of corrupted or invalid snapshots from IndexedDB
- **Stability**: Fixed potential race condition in `installRootGuard` where `reset()` failures could cause permanent lockup
- **Developer Experience**: Added DevTools events and console logging when snapshots are skipped due to age limits, improving debugging visibility

## 0.4.2

### Patch Changes

### 🔄 Refactoring

- **SSR Compatibility**: Prevent crashes when using in SSR framework client components (`7c498ff`)

### 🐛 Bug Fixes

- **Node Version**: Fixed compatibility with Node.js version constraints (`5a28b43`)

## 0.4.1

### Patch Changes

**Added**

- DevTools integration: added event emission for debugging and monitoring
  - `capture` events: emitted when snapshot is captured with route, body size, and style count
  - `restore` events: emitted during boot when snapshot is restored with strategy and duration
  - `handoff` events: emitted during React hydration handoff with strategy selection
  - `hydration.error` events: emitted on hydration mismatches with error details and recovery status
  - `storage.error` events: emitted on IndexedDB failures with operation type and recoverability

**Changed**

- Internal: added `emitDevToolsEvent()` calls throughout prepaint lifecycle
- No breaking changes to public API

**Technical**

- Events use priority system (NORMAL for lifecycle, HIGH for errors)
- All events include route context for debugging
- Events are no-op when DevTools extension is not present

## 0.4.0

### Minor Changes

implement structured error handling with custom error classes

BREAKING CHANGE: Error logging format has changed from generic console.error to structured error classes

**Added**

- PrepaintError abstract base class with getUserMessage(), getDebugInfo(), isRecoverable()
- BootError for boot phase failures (db-open, snapshot-read, dom-restore, style-injection)
- CaptureError for capture phase failures (dom-serialize, style-collect, db-write)
- HydrationError for React hydration mismatches (content, attribute, structure)
- PrepaintStorageError for IndexedDB operations (QUOTA_EXCEEDED, PERMISSION_DENIED, UNKNOWN)
- convertDOMException utility to transform DOMExceptions into PrepaintStorageError

**Changed**

- All error paths now use structured error classes instead of generic Error
- Error logs always output (removed **FIRSTTX_DEV** conditional for errors)
- Success logs remain conditional on **FIRSTTX_DEV** flag
- Hydration errors use console.warn instead of console.error
- Updated CreateFirstTxRootOptions.onHydrationError to accept HydrationError type

**Tests**

- Enhanced boot.test.ts with 5 error handling scenarios
- Enhanced capture.test.ts with 7 error handling scenarios
- Added comprehensive error validation (phase, message, recoverability)
- All tests verify structured error output format

This aligns prepaint's error handling with local-first and tx packages,
providing consistent error interfaces across the FirstTx ecosystem while
maintaining the "silent failure" philosophy (errors don't break the app).

## 0.3.2

### Patch Changes

**REFACTOR**

- align stylesheet capture expectations

**FIX**

- defer overlay mount until body exists

## 0.3.1

### Patch Changes

TEST

- hydration failure tests

DOCS

- update README

## 0.3.0

### Minor Changes

**Add overlay mode and hard hydration bailout to prepaint**

This release introduces significant improvements to snapshot capture and hydration reliability:

**Breaking Changes:**

- `captureSnapshot()` now uses root element serialization instead of `body.innerHTML`
- Requires `#root` element to be present for capture to work

**New Features:**

- **Overlay mode support:** Adds global `__FIRSTTX_DEV__` flag for development logging
- **Volatile data handling:** Elements with `data-firsttx-volatile` attribute are automatically cleared during capture (useful for timestamps, random values)
- **Style filtering:** Prepaint-injected styles are now excluded from capture via `data-firsttx-prepaint` attribute
- **Enhanced capture timing:**
  - Captures on `visibilitychange` (when page becomes hidden)
  - Captures on `pagehide` (mobile-friendly)
  - Maintains `beforeunload` capture
  - Debounced with microtask queue to prevent duplicate saves

**Improvements:**

- Cleaner serialization: Only captures first child of root element
- More reliable hydration: Filters out dynamic content that causes mismatches
- Better mobile support: `pagehide` event works more reliably on iOS/Android
- Development experience: `__FIRSTTX_DEV__` replaces `process.env.NODE_ENV` checks

**Migration Guide:**

```tsx
// If you have dynamic content that changes on every render:
<span data-firsttx-volatile>{Date.now()}</span>
<div data-firsttx-volatile>{Math.random()}</div>

// Vite plugin automatically injects __FIRSTTX_DEV__ flag
// No changes needed to your vite.config.ts
```

## 0.2.0

### Minor Changes

Add debug hooks and improve error handling

BREAKING CHANGE: captureSnapshot now returns Promise<Snapshot | null>

Added:

- onCapture/onHandoff callbacks to createFirstTxRoot
- SetupCaptureOptions interface (routes filter, onCapture callback)
- Graceful error handling in captureSnapshot

This allows developers to debug capture lifecycle and filter routes:

```tsx
createFirstTxRoot(root, <App />, {
  onCapture: (s) => console.log('Captured:', s),
  onHandoff: (strategy) => console.log(strategy),
});
```

## 0.1.3

### Patch Changes

- Fix: call boot function in injected script

## 0.1.2

### Patch Changes

- modify the build script to include boot.js in the build

## 0.1.1

### Patch Changes

- fix test and fix some patch bugs

## 0.1.0

### Minor Changes

- First public release of prepaint: Instant page restoration from IndexedDB snapshots / Zero blank-screen time on return visits / Automatic React hydration with ViewTransition support

```

```
