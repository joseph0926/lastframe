# Governance

This document describes the governance model for Lastframe.

## Roles

### Maintainers

Maintainers have full access to the repository including:

- Merging pull requests
- Creating releases
- Managing CI/CD and repository settings
- Final decision authority on technical direction

Current maintainers:

| Name       | GitHub                                       | Email                    |
| ---------- | -------------------------------------------- | ------------------------ |
| joseph0926 | [@joseph0926](https://github.com/joseph0926) | joseph0926.dev@gmail.com |

### Reviewers

Reviewers can approve pull requests but cannot merge without maintainer approval. Reviewers are trusted contributors who have demonstrated understanding of the codebase.

### Contributors

Anyone who submits issues, pull requests, or participates in discussions.

## Decision Making

### Standard Changes

For most changes (bug fixes, minor features, documentation):

1. Submit a pull request
2. Pass all required CI checks
3. Resolve review conversations
4. The maintainer merges the PR

### Significant Changes

For changes that affect the public API, the storage format, or the architecture:

1. Open a GitHub Discussion or Issue first
2. Gather feedback from maintainers and community
3. Submit PR with detailed description of the change
4. Record the maintainer's decision after review

### Breaking Changes

Breaking changes require:

1. GitHub Discussion for design review
2. Clear migration guide in PR description
3. Changelog entry documenting the break
4. An explicit maintainer decision

## Code Review

### Requirements

- The repository is operated by one maintainer, so the ruleset requires zero approving reviews
- CI must pass `Verify`
- Review conversations must be resolved
- Changes to the published package require a changeset

### CODEOWNERS

The [CODEOWNERS](.github/CODEOWNERS) file defines code ownership:

- Source and workflow changes are routed to the maintainer
- Code owner review is not a required ruleset condition while the repository has one maintainer

### Branch Protection

The active `main protection` ruleset protects the default branch:

- Require pull request before merging
- Require zero approving reviews
- Require branches to be up to date
- Require `Verify`
- Require conversation resolution before merging
- Disallow bypass, force pushes, and branch deletion

## Release Process

1. Contributors add changesets via `pnpm changeset`
2. The Changesets action creates a "Version Packages" PR
3. Maintainer reviews and merges the version PR
4. CI stages the new version on npm with `npm stage publish` through trusted publishing
5. Maintainer approves the staged version on npmjs.com with 2FA
6. Maintainer runs the "GitHub Release" workflow with the merge commit SHA to create the tag and release

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

## Security

Security vulnerabilities should be reported privately. See [SECURITY.md](./SECURITY.md) for the disclosure process.

## Communication

- **Issues**: Bug reports and feature requests
- **Discussions**: Questions, ideas, and general discussion
- **Pull Requests**: Code contributions

## Changes to Governance

Changes to this governance document require maintainer approval and should be discussed in a GitHub Issue first.
