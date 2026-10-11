const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// The repository root is the only published package.
const PACKAGE_NAME_PATTERN = /^lastframe$/;
const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PACKAGE_MANIFEST_PATTERN = /^package\.json$/;
// The registry can answer 404 for a few seconds to minutes after `changeset publish`
// succeeds, so the publish check polls instead of reading once.
const DEFAULT_PUBLISH_WAIT = { attempts: 12, delayMs: 10_000 };

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function parsePackageManifests(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 20_000) {
    throw new Error('PACKAGE_MANIFESTS must be a non-empty JSON string');
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('PACKAGE_MANIFESTS must contain valid JSON', { cause: error });
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 50) {
    throw new Error('PACKAGE_MANIFESTS must contain between 1 and 50 paths');
  }

  const paths = new Set();

  return parsed.map((manifestPath) => {
    if (typeof manifestPath !== 'string' || !PACKAGE_MANIFEST_PATTERN.test(manifestPath)) {
      throw new Error('PACKAGE_MANIFESTS contains an invalid path');
    }

    if (paths.has(manifestPath)) {
      throw new Error(`PACKAGE_MANIFESTS contains duplicate path ${manifestPath}`);
    }

    paths.add(manifestPath);
    return manifestPath;
  });
}

function parsePublishedPackages(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 20_000) {
    throw new Error('PUBLISHED_PACKAGES must be a non-empty JSON string');
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('PUBLISHED_PACKAGES must contain valid JSON', { cause: error });
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 50) {
    throw new Error('PUBLISHED_PACKAGES must contain between 1 and 50 packages');
  }

  const names = new Set();

  return parsed.map((entry) => {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof entry.name !== 'string' ||
      typeof entry.version !== 'string' ||
      !PACKAGE_NAME_PATTERN.test(entry.name) ||
      !VERSION_PATTERN.test(entry.version)
    ) {
      throw new Error('PUBLISHED_PACKAGES contains an invalid package');
    }

    if (names.has(entry.name)) {
      throw new Error(`PUBLISHED_PACKAGES contains duplicate package ${entry.name}`);
    }

    names.add(entry.name);
    return { name: entry.name, version: entry.version };
  });
}

function extractReleaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = `## ${version}`;
  const start = lines.findIndex((line) => line.trim() === heading);

  if (start === -1) {
    throw new Error(`Could not find changelog entry for version ${version}`);
  }

  const nextHeading = lines.findIndex((line, index) => index > start && /^##\s+\S/.test(line));
  const notes = lines
    .slice(start + 1, nextHeading === -1 ? undefined : nextHeading)
    .join('\n')
    .trim();

  if (notes.length === 0) {
    throw new Error(`Changelog entry for version ${version} is empty`);
  }

  if (notes.length > 60_000) {
    throw new Error(`Changelog entry for version ${version} exceeds 60000 characters`);
  }

  return `${notes}\n`;
}

function publishedPackagesFromManifests(rootDir, manifestPaths) {
  const packages = manifestPaths.map((manifestPath) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, manifestPath), 'utf8'));
    return { name: manifest.name, version: manifest.version };
  });

  return parsePublishedPackages(JSON.stringify(packages));
}

function createReleasePlan(rootDir, publishedPackages) {
  const manifests = new Map();
  const manifestPath = path.join(rootDir, 'package.json');

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (typeof manifest.name === 'string') {
      manifests.set(manifest.name, { manifest, packageDir: rootDir });
    }
  }

  return publishedPackages.map(({ name, version }) => {
    const found = manifests.get(name);

    if (!found || found.manifest.private === true || found.manifest.version !== version) {
      throw new Error(`Published package ${name}@${version} does not match the verified revision`);
    }

    const changelogPath = path.join(found.packageDir, 'CHANGELOG.md');

    if (!fs.existsSync(changelogPath)) {
      throw new Error(`Missing changelog for ${name}@${version}`);
    }

    return {
      name,
      version,
      tag: `${name}@${version}`,
      prerelease: version.includes('-'),
      notes: extractReleaseNotes(fs.readFileSync(changelogPath, 'utf8'), version),
    };
  });
}

function commandError(command, result) {
  const details = `${result.stderr || result.stdout || ''}`.trim();
  const error = new Error(`${command} failed${details ? `: ${details}` : ''}`);
  const statusMatch = details.match(/HTTP (\d{3})/);
  const npmCodeMatch = details.match(/npm error code (\S+)/);

  if (statusMatch) {
    error.httpStatus = Number(statusMatch[1]);
  }

  if (npmCodeMatch) {
    error.npmCode = npmCodeMatch[1];
  }

  return error;
}

function runCommand(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw commandError(`${command} ${args.join(' ')}`, result);
  }

  return result.stdout.trim();
}

function createCliApi(repository) {
  function request(method, endpoint, body) {
    const args = [
      'api',
      '--method',
      method,
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
      endpoint,
    ];

    if (body !== undefined) {
      args.push('--input', '-');
    }

    const output = runCommand('gh', args, body === undefined ? undefined : JSON.stringify(body));
    return output === '' ? null : JSON.parse(output);
  }

  function optionalRequest(endpoint) {
    try {
      return request('GET', endpoint);
    } catch (error) {
      if (error.httpStatus === 404) {
        return null;
      }
      throw error;
    }
  }

  function resolveTagTarget(tag) {
    const ref = optionalRequest(`repos/${repository}/git/ref/${encodeURIComponent(`tags/${tag}`)}`);

    if (ref === null) {
      return null;
    }

    let object = ref.object;

    for (let depth = 0; depth < 5; depth += 1) {
      if (object.type === 'commit') {
        return object.sha;
      }

      if (object.type !== 'tag') {
        throw new Error(`Tag ${tag} points to unsupported object type ${object.type}`);
      }

      object = request('GET', `repos/${repository}/git/tags/${object.sha}`).object;
    }

    throw new Error(`Tag ${tag} contains too many nested tag objects`);
  }

  return {
    /** Returns null while the registry does not show the version yet. */
    getPublishedVersion(name, version) {
      try {
        const output = runCommand('npm', ['view', `${name}@${version}`, 'version', '--json']);
        return JSON.parse(output);
      } catch (error) {
        if (error.npmCode === 'E404') {
          return null;
        }
        throw error;
      }
    },
    getRelease(tag) {
      return optionalRequest(`repos/${repository}/releases/tags/${encodeURIComponent(tag)}`);
    },
    getTagTarget: resolveTagTarget,
    createRelease(release, releaseSha) {
      return request('POST', `repos/${repository}/releases`, {
        tag_name: release.tag,
        target_commitish: releaseSha,
        name: release.tag,
        body: release.notes,
        draft: false,
        prerelease: release.prerelease,
        generate_release_notes: false,
      });
    },
  };
}

function validateExistingRelease(release, planned) {
  if (
    release.tag_name !== planned.tag ||
    release.draft !== false ||
    release.prerelease !== planned.prerelease
  ) {
    throw new Error(`Existing release ${planned.tag} does not match the release plan`);
  }
}

function waitForPublishedVersion(api, planned, { publishWait, sleep, log }) {
  for (let attempt = 1; attempt <= publishWait.attempts; attempt += 1) {
    const publishedVersion = api.getPublishedVersion(planned.name, planned.version);

    if (publishedVersion === planned.version) {
      return;
    }

    // A different version is a real mismatch, not a propagation delay.
    if (publishedVersion !== null || attempt === publishWait.attempts) {
      break;
    }

    log(
      `npm does not show ${planned.name}@${planned.version} yet; retrying in ${publishWait.delayMs} ms (${attempt}/${publishWait.attempts})`,
    );
    sleep(publishWait.delayMs);
  }

  throw new Error(`npm does not contain ${planned.name}@${planned.version}`);
}

function createGithubReleases({
  plan,
  releaseSha,
  api,
  dryRun = false,
  log = console.log,
  publishWait = DEFAULT_PUBLISH_WAIT,
  sleep = sleepSync,
}) {
  if (!SHA_PATTERN.test(releaseSha)) {
    throw new Error('RELEASE_SHA must be a full lowercase commit SHA');
  }

  for (const planned of plan) {
    waitForPublishedVersion(api, planned, { publishWait, sleep, log });

    const existingRelease = api.getRelease(planned.tag);
    const existingTarget = api.getTagTarget(planned.tag);

    if (existingTarget !== null && existingTarget !== releaseSha) {
      throw new Error(
        `Existing tag ${planned.tag} points to ${existingTarget}, expected ${releaseSha}`,
      );
    }

    if (existingRelease !== null) {
      if (existingTarget === null) {
        throw new Error(`Existing release ${planned.tag} has no matching tag`);
      }

      validateExistingRelease(existingRelease, planned);
      log(`Release ${planned.tag} already exists at the verified revision`);
      continue;
    }

    if (dryRun) {
      log(`Would create release ${planned.tag} at ${releaseSha}`);
      continue;
    }

    api.createRelease(planned, releaseSha);

    const createdRelease = api.getRelease(planned.tag);
    const createdTarget = api.getTagTarget(planned.tag);

    if (createdRelease === null || createdTarget !== releaseSha) {
      throw new Error(`Failed to verify created release ${planned.tag}`);
    }

    validateExistingRelease(createdRelease, planned);
    log(`Created release ${planned.tag}`);
  }
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const releaseSha = process.env.RELEASE_SHA;

  if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is invalid');
  }

  const manifestPaths = parsePackageManifests(process.env.PACKAGE_MANIFESTS);
  const publishedPackages = publishedPackagesFromManifests(process.cwd(), manifestPaths);
  const plan = createReleasePlan(process.cwd(), publishedPackages);
  const api = createCliApi(repository);

  createGithubReleases({
    plan,
    releaseSha,
    api,
    dryRun: process.env.RELEASE_DRY_RUN === 'true',
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createGithubReleases,
  createReleasePlan,
  extractReleaseNotes,
  parsePackageManifests,
  parsePublishedPackages,
  publishedPackagesFromManifests,
};
