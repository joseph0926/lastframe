# Security Policy

## Supported Versions

| Version  | Supported |
| -------- | --------- |
| latest   | Yes       |
| < latest | No        |

We only provide security updates for the latest version of `lastframe`. Please ensure you are using the latest version before reporting a vulnerability.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

1. **Email**: Send a detailed report to [joseph0926.dev@gmail.com](mailto:joseph0926.dev@gmail.com)
2. **GitHub Security Advisories**: Use [GitHub's private vulnerability reporting](https://github.com/joseph0926/lastframe/security/advisories/new)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

| Stage                    | Expected Time                      |
| ------------------------ | ---------------------------------- |
| Initial response         | 48 hours                           |
| Vulnerability assessment | 7 days                             |
| Fix development          | 14-30 days (depending on severity) |
| Public disclosure        | After fix is released              |

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Assessment**: We will investigate and determine the severity
3. **Updates**: We will keep you informed of our progress
4. **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices for Users

### Data handling

- Lastframe stores a copy of what was on screen in IndexedDB, which is not encrypted. Mask or exclude anything that should not be copied, with `data-lastframe-mask`, `data-lastframe-exclude`, or the `mask` and `exclude` options.
- Call `setScope()` after sign-in and `setScope(null)` plus `clearFrames()` on sign-out, so a shared device never replays another user's screen.
- Set `styles: false` if your stylesheets can contain user-controlled data.

### Content security

- The boot script is emitted as a hashed file by default. If you set `inline: true`, allow it with a CSP hash or the `nonce` option.

## Security Features

- **Masking before storage**: masked text and media are replaced before the frame is written, so the original content never reaches IndexedDB. Password field values are never stored.
- **Sanitized restore**: scripts, frames, `meta`, `link`, `base`, event handlers, executable URL schemes, links, and form targets are removed before a frame is painted.
- **Inert overlay**: the frame is painted in a shadow root outside the app container, marked `inert` and `aria-hidden`, and swallows pointer events.
- **Scoped and versioned frames**: frames are only replayed for the scope and version that captured them.
- **No eval()**: no dynamic code execution.
