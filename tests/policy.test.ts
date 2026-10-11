import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  maskSignature,
  matchRoute,
  normalizePolicy,
  serializePolicy,
  validatePolicy,
} from '../src/policy';

describe('policy parsing', () => {
  it('is disabled without routes', () => {
    expect(normalizePolicy(undefined)).toBeNull();
    expect(normalizePolicy(null)).toBeNull();
    expect(normalizePolicy({ routes: [] })).toBeNull();
  });

  it('fills defaults and normalizes route entries', () => {
    const policy = normalizePolicy({ routes: ['/inbox/', '/inbox', { path: '/a', mask: true }] });

    expect(policy).toEqual({
      routes: [
        { path: '/inbox', mask: false },
        { path: '/a', mask: true },
      ],
      mask: false,
      exclude: [],
      ttl: DEFAULTS.ttl,
      maxBytes: DEFAULTS.maxBytes,
      maxFrames: DEFAULTS.maxFrames,
      styles: true,
      timeout: DEFAULTS.timeout,
      version: null,
      root: '#root',
    });
  });

  it('lets routes inherit the policy-wide mask unless they override it', () => {
    const policy = normalizePolicy({
      routes: ['/', { path: '/public', mask: false }],
      mask: ['.email'],
    });

    expect(policy?.routes).toEqual([
      { path: '/', mask: ['.email'] },
      { path: '/public', mask: false },
    ]);
  });

  it.each([
    [{ routes: 'dashboard' }, '`routes` must be an array'],
    [{ routes: ['dashboard'] }, 'starts with `/`'],
    [{ routes: ['/'], ttl: 0 }, '`ttl`'],
    [{ routes: ['/'], maxBytes: 1.5 }, '`maxBytes`'],
    [{ routes: ['/'], maxFrames: -1 }, '`maxFrames`'],
    [{ routes: ['/'], timeout: Number.NaN }, '`timeout`'],
    [{ routes: ['/'], mask: 'yes' }, '`mask`'],
    [{ routes: [{ path: '/', mask: [1] }] }, '`mask` for /'],
    [{ routes: ['/'], exclude: '.toast' }, '`exclude`'],
    [{ routes: ['/'], styles: 'no' }, '`styles`'],
    [{ routes: ['/'], version: 3 }, '`version`'],
    [{ routes: ['/'], root: ' ' }, '`root`'],
  ])('rejects %j at build time', (input, message) => {
    expect(() => validatePolicy(input)).toThrow(message);
    expect(normalizePolicy(input)).toBeNull();
  });
});

describe('route matching', () => {
  const policy = normalizePolicy({
    routes: ['/', '/inbox', '/projects/:id', '/docs/*', { path: '/projects/new', mask: true }],
  });

  it.each([
    ['/', '/'],
    ['/inbox', '/inbox'],
    ['/inbox/', '/inbox'],
    ['/projects/42', '/projects/:id'],
    ['/docs', '/docs/*'],
    ['/docs/guide/intro', '/docs/*'],
  ])('matches %s with %s', (pathname, expected) => {
    expect(matchRoute(policy, pathname)?.path).toBe(expected);
  });

  it.each(['/settings', '/projects', '/projects/42/edit', '/inboxes'])(
    'does not match %s',
    (pathname) => {
      expect(matchRoute(policy, pathname)).toBeNull();
    },
  );

  it('prefers an exact path over a pattern', () => {
    expect(matchRoute(policy, '/projects/new')).toEqual({ path: '/projects/new', mask: true });
  });

  it('matches nothing without a policy', () => {
    expect(matchRoute(null, '/')).toBeNull();
  });
});

describe('serialization', () => {
  it('escapes characters that could close the script element', () => {
    const policy = validatePolicy({ routes: ['/'], exclude: ['</script><script>alert(1)'] });
    const json = serializePolicy(policy);

    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual(policy);
  });

  it('gives masks a stable signature', () => {
    expect(maskSignature(true)).toBe('all');
    expect(maskSignature(false)).toBe('none');
    expect(maskSignature([])).toBe('none');
    expect(maskSignature(['.b', '.a'])).toBe(maskSignature(['.a', '.b']));
  });
});
