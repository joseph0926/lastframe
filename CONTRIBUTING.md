# Contributing to Lastframe

Thank you for your interest in contributing. This document explains how to work on the project.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## Getting started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 11.17.0 (the version in `package.json#packageManager`)

### Setup

```bash
git clone https://github.com/<your-username>/lastframe.git
cd lastframe
pnpm install
git switch -c feat/your-change
```

## Repository layout

| Path      | What it is                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/`    | The `lastframe` package. Entries: core, `react/`, `vite/`, `build/`.                                             |
| `tests/`  | Vitest tests in jsdom, with `fake-indexeddb`.                                                                    |
| `demo/`   | The live demo. Not a separate package: it runs on the root's dependencies and imports the built package by name. |
| `docs/`   | The Korean README, the migration guide, and the FirstTx changelog.                                               |
| `assets/` | Images used by the README.                                                                                       |

The boot script that runs before an app's bundle is `src/boot-script.ts`. It is prebuilt in four variants by `tsdown.config.ts`, and `src/build/boot-script.ts` picks one by file name. Keep both in sync.

## Development

```bash
pnpm test            # watch mode
pnpm test:run        # once, as CI does
pnpm typecheck
pnpm lint
pnpm format
pnpm build           # library into dist/
pnpm check:package   # publint and Are the Types Wrong, after build
pnpm demo            # build, then start the demo at http://localhost:5173/lastframe/
```

To see a change end to end, run `pnpm demo:build && pnpm demo:preview`, open the demo, and reload it. Use the Application panel of your browser's devtools to inspect the `lastframe` IndexedDB database.

## Pull requests

1. Run `pnpm verify`. It runs type checks, lint, format check, tests, the release script tests, the build, and the package checks, the same as CI.
2. Update the README (and `docs/README.ko.md`) when you change behavior or options.
3. Add a changeset when the change affects the published package: `pnpm changeset`.

### Checklist

- [ ] Tests added or updated
- [ ] Documentation updated, if behavior changed
- [ ] Changeset added, if the package changed
- [ ] Breaking changes documented with a migration note

## Coding standards

- Strict TypeScript; no `any` where a real type is possible.
- Lastframe must never break the host app. Failures in boot or capture are caught and reported through the development logger, and the page loads as if Lastframe were not there.
- The boot path is size-sensitive. Check `dist/boot/boot.prod.min.iife.js` after changes that touch `src/boot.ts` or its imports.
- Comments explain why, not what.

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <description>`.

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`.
Scopes: `core`, `react`, `vite`, `build`, `demo`, `docs`, `deps`.

```
feat(core): add pattern routes
fix(vite): resolve the boot script path for a relative base
docs: clarify the ready condition
```

## Issues

Use the issue templates. For bugs, include the browser, the framework and bundler versions, and a minimal reproduction. For questions, use [GitHub Discussions](https://github.com/joseph0926/lastframe/discussions).

## Need help?

- [Issues](https://github.com/joseph0926/lastframe/issues)
- Email: joseph0926.dev@gmail.com
