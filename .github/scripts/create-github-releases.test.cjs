const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createGithubReleases,
  createReleasePlan,
  extractReleaseNotes,
  parsePackageManifests,
  parsePublishedPackages,
  publishedPackagesFromManifests,
} = require('./create-github-releases.cjs');

const RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastframe-release-'));
  const packageDir = rootDir;

  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify({ name: 'lastframe', version: '1.2.3' }),
  );
  fs.writeFileSync(
    path.join(packageDir, 'CHANGELOG.md'),
    '# lastframe\n\n## 1.2.3\n\n- Safe release\n\n## 1.2.2\n\n- Previous\n',
  );

  return rootDir;
}

function createApi({ publishedVersion = '1.2.3', target = null, release = null } = {}) {
  let currentTarget = target;
  let currentRelease = release;
  const created = [];

  return {
    created,
    getPublishedVersion() {
      return publishedVersion;
    },
    getRelease() {
      return currentRelease;
    },
    getTagTarget() {
      return currentTarget;
    },
    createRelease(planned, releaseSha) {
      created.push({ planned, releaseSha });
      currentTarget = releaseSha;
      currentRelease = {
        tag_name: planned.tag,
        draft: false,
        prerelease: planned.prerelease,
      };
    },
  };
}

test('parses and validates published packages', () => {
  assert.deepEqual(parsePublishedPackages('[{"name":"lastframe","version":"1.2.3"}]'), [
    { name: 'lastframe', version: '1.2.3' },
  ]);
  assert.throws(
    () => parsePublishedPackages('[{"name":"other","version":"1.2.3"}]'),
    /invalid package/,
  );
  assert.throws(
    () =>
      parsePublishedPackages(
        '[{"name":"lastframe","version":"1.2.3"},{"name":"lastframe","version":"1.2.4"}]',
      ),
    /duplicate package/,
  );
});

test('parses and validates package manifest paths', () => {
  assert.deepEqual(parsePackageManifests('["package.json"]'), ['package.json']);
  assert.throws(() => parsePackageManifests('["demo/package.json"]'), /invalid path/);
  assert.throws(() => parsePackageManifests('["package.json","package.json"]'), /duplicate path/);
});

test('extracts only the requested changelog section', () => {
  const notes = extractReleaseNotes(
    '# Package\n\n## 1.2.3\n\n- Current\n\n## Unreleased\n\n- Future\n',
    '1.2.3',
  );

  assert.equal(notes, '- Current\n');
});

test('builds a release plan from the verified package manifests', (context) => {
  const rootDir = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const publishedPackages = publishedPackagesFromManifests(rootDir, [
    'package.json',
  ]);

  assert.deepEqual(createReleasePlan(rootDir, publishedPackages), [
    {
      name: 'lastframe',
      version: '1.2.3',
      tag: 'lastframe@1.2.3',
      prerelease: false,
      notes: '- Safe release\n',
    },
  ]);
  assert.throws(
    () => createReleasePlan(rootDir, [{ name: 'lastframe', version: '1.2.4' }]),
    /does not match the verified revision/,
  );
});

test('creates and verifies a missing release', () => {
  const api = createApi();
  const plan = [
    {
      name: 'lastframe',
      version: '1.2.3',
      tag: 'lastframe@1.2.3',
      prerelease: false,
      notes: '- Safe release\n',
    },
  ];

  createGithubReleases({ plan, releaseSha: RELEASE_SHA, api, log() {} });

  assert.equal(api.created.length, 1);
  assert.equal(api.created[0].releaseSha, RELEASE_SHA);
});

test('dry-run validates a missing release without creating it', () => {
  const api = createApi();
  const messages = [];
  const plan = [
    {
      name: 'lastframe',
      version: '1.2.3',
      tag: 'lastframe@1.2.3',
      prerelease: false,
      notes: '- Safe release\n',
    },
  ];

  createGithubReleases({
    plan,
    releaseSha: RELEASE_SHA,
    api,
    dryRun: true,
    log(message) {
      messages.push(message);
    },
  });

  assert.equal(api.created.length, 0);
  assert.deepEqual(messages, [`Would create release lastframe@1.2.3 at ${RELEASE_SHA}`]);
});

test('skips an existing release at the verified revision', () => {
  const api = createApi({
    target: RELEASE_SHA,
    release: {
      tag_name: 'lastframe@1.2.3',
      draft: false,
      prerelease: false,
    },
  });
  const plan = [
    {
      name: 'lastframe',
      version: '1.2.3',
      tag: 'lastframe@1.2.3',
      prerelease: false,
      notes: '- Safe release\n',
    },
  ];

  createGithubReleases({ plan, releaseSha: RELEASE_SHA, api, log() {} });

  assert.equal(api.created.length, 0);
});

test('rejects npm mismatches and conflicting tags', () => {
  const plan = [
    {
      name: 'lastframe',
      version: '1.2.3',
      tag: 'lastframe@1.2.3',
      prerelease: false,
      notes: '- Safe release\n',
    },
  ];

  assert.throws(
    () =>
      createGithubReleases({
        plan,
        releaseSha: RELEASE_SHA,
        api: createApi({ publishedVersion: '1.2.2' }),
        log() {},
      }),
    /npm does not contain/,
  );
  assert.throws(
    () =>
      createGithubReleases({
        plan,
        releaseSha: RELEASE_SHA,
        api: createApi({ target: 'abcdef0123456789abcdef0123456789abcdef01' }),
        log() {},
      }),
    /points to/,
  );
});

const PUBLISH_PLAN = [
  {
    name: 'lastframe',
    version: '1.2.3',
    tag: 'lastframe@1.2.3',
    prerelease: false,
    notes: '- Safe release\n',
  },
];

function apiWithPublishedVersions(versions) {
  const api = createApi();
  api.getPublishedVersion = () => versions.shift();
  return api;
}

test('waits for a just-published version to appear on npm', () => {
  const api = apiWithPublishedVersions([null, null, '1.2.3']);
  const sleeps = [];

  createGithubReleases({
    plan: PUBLISH_PLAN,
    releaseSha: RELEASE_SHA,
    api,
    log() {},
    publishWait: { attempts: 5, delayMs: 10 },
    sleep: (milliseconds) => sleeps.push(milliseconds),
  });

  assert.deepEqual(sleeps, [10, 10]);
  assert.equal(api.created.length, 1);
});

test('gives up when npm never shows the published version', () => {
  const api = apiWithPublishedVersions([null, null, null]);
  const sleeps = [];

  assert.throws(
    () =>
      createGithubReleases({
        plan: PUBLISH_PLAN,
        releaseSha: RELEASE_SHA,
        api,
        log() {},
        publishWait: { attempts: 3, delayMs: 10 },
        sleep: (milliseconds) => sleeps.push(milliseconds),
      }),
    /npm does not contain lastframe@1\.2\.3/,
  );
  assert.equal(sleeps.length, 2);
  assert.equal(api.created.length, 0);
});

test('does not wait when npm reports a different version', () => {
  const sleeps = [];

  assert.throws(
    () =>
      createGithubReleases({
        plan: PUBLISH_PLAN,
        releaseSha: RELEASE_SHA,
        api: apiWithPublishedVersions(['1.2.2']),
        log() {},
        publishWait: { attempts: 5, delayMs: 10 },
        sleep: (milliseconds) => sleeps.push(milliseconds),
      }),
    /npm does not contain/,
  );
  assert.equal(sleeps.length, 0);
});
