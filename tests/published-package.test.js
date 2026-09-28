'use strict';

/**
 * Supply-chain and packaging integrity for a static asset pack.
 *
 * This package is installed by people who only want two CSS files and a PNG.
 * That makes the packaging metadata a security boundary, not just release
 * bookkeeping:
 *
 *   - A consumer running `npm install bootstrap-glyphicons` must never execute
 *     code. That means zero dependencies and zero lifecycle scripts.
 *   - A consumer's browser must never be pointed off-site by this stylesheet.
 *     A single `url(https://...)` or `@import` turns a trusted icon font into a
 *     tracking pixel and an outage dependency on a third party.
 *   - A `url()` that walks out of the package with `../` would make the
 *     browser request arbitrary files relative to the consuming site.
 *
 * These are the checks a normal "did the icons still work" test never makes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PATHS, ROOT, rel, readText, readJson, listFiles } = require('./helpers/repo');
const { extractUrls, extractImports } = require('./helpers/css');

const pkg = readJson(PATHS.PACKAGE_JSON);
const lock = readJson(PATHS.PACKAGE_LOCK);

const SHIPPED_STYLESHEETS = [
  ['bootstrap.icon-large.css', readText(PATHS.SRC_CSS)],
  ['bootstrap.icon-large.min.css', readText(PATHS.MIN_CSS)],
];

// npm lifecycle hooks. Any of these would run on a consumer's machine.
const LIFECYCLE_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'preprepare',
  'prepare',
  'postprepare',
  'prepublish',
  'prepublishOnly',
  'prepack',
  'postpack',
  'preversion',
  'postversion',
];

/** Expand an npm `files[]` entry into a predicate over repo-relative paths. */
function isPublished(file, files) {
  return files.some((entry) => {
    const normalized = String(entry).replace(/\/+$/, '');
    if (!normalized) {
      return false;
    }
    if (/[*?[\]{}]/.test(normalized)) {
      return file === normalized || file.startsWith(`${normalized}/`);
    }
    return file === normalized || file.startsWith(`${normalized}/`);
  });
}

test.describe('dependency hygiene', () => {
  test('the package declares no runtime or development dependencies', () => {
    assert.deepEqual(pkg.dependencies ?? {}, {}, 'runtime dependencies are not acceptable in an asset pack');
    assert.deepEqual(pkg.devDependencies ?? {}, {}, 'dev dependencies are not acceptable in an asset pack');
    assert.equal(pkg.peerDependencies, undefined, 'an asset pack has no peer dependencies');
    assert.equal(pkg.bundledDependencies, undefined, 'bundled dependencies are not acceptable in an asset pack');
  });

  test('no lifecycle script can execute during a consumer install', () => {
    const scripts = pkg.scripts ?? {};
    const dangerous = LIFECYCLE_SCRIPTS.filter((name) => typeof scripts[name] === 'string');
    assert.deepEqual(dangerous, [], `lifecycle scripts execute on install: ${dangerous.join(', ')}`);
  });

  test('the lockfile matches package.json so `npm ci` is reproducible', () => {
    assert.equal(lock.name, pkg.name, 'lockfile name does not match package.json');
    assert.equal(lock.version, pkg.version, 'lockfile version does not match package.json');
    assert.ok(
      lock.lockfileVersion >= 2,
      `lockfileVersion ${lock.lockfileVersion} is too old for a reproducible install`
    );

    const root = lock.packages?.[''];
    assert.ok(root, 'lockfile has no root package entry');
    assert.equal(root.name, pkg.name);
    assert.equal(root.version, pkg.version);
    assert.deepEqual(root.dependencies ?? {}, {}, 'lockfile root declares dependencies that package.json does not');
    assert.deepEqual(
      root.devDependencies ?? {},
      {},
      'lockfile root declares devDependencies that package.json does not'
    );

    const extras = Object.keys(lock.packages).filter((key) => key !== '');
    assert.deepEqual(extras, [], `lockfile pins packages the manifest does not declare: ${extras.join(', ')}`);
  });

  test('the declared Node engine matches .nvmrc and the CI matrix', () => {
    assert.ok(pkg.engines?.node, 'package.json must declare engines.node so CI and consumers agree');

    const nvmrc = readText(PATHS.NVMRC).trim();
    assert.match(nvmrc, /^\d+$/, `.nvmrc should pin an exact major version, got ${JSON.stringify(nvmrc)}`);

    const minimum = String(pkg.engines.node).replace(/[^\d.]/g, '');
    assert.ok(
      Number(nvmrc) >= Math.floor(Number(minimum)),
      `.nvmrc (${nvmrc}) is older than engines.node (${pkg.engines.node})`
    );

    const workflow = readText(path.join(ROOT, '.github', 'workflows', 'ci.yml'));
    for (const major of ['20', '22', '24']) {
      assert.ok(
        new RegExp(`node:\\s*\\[?[^\\]]*'${major}'`).test(workflow) || workflow.includes(`'${major}'`),
        `CI matrix does not test Node ${major}`
      );
    }
  });
});

test.describe('published file list', () => {
  const files = pkg.files ?? [];

  test('every shipped asset is included in the published tarball', () => {
    const required = ['css/bootstrap.icon-large.css', 'css/bootstrap.icon-large.min.css', 'glyphicons.png', 'img/'];
    const missing = required.filter((asset) => !isPublished(asset, files));
    assert.deepEqual(missing, [], `not published: ${missing.join(', ')}`);
  });

  test('test and tooling directories are excluded from the tarball', () => {
    // Shipping the verification suite would add ~1k lines of Node to every
    // consumer install for no benefit, and would widen the published surface.
    const leaks = ['tests/verify_css_mapping.js', 'tests/helpers/repo.js', 'tools/lint.js', '.github/workflows/ci.yml']
      .filter((candidate) => isPublished(candidate, files));
    assert.deepEqual(leaks, [], `unintended files in the tarball: ${leaks.join(', ')}`);
  });

  test('every declared file entry exists on disk', () => {
    const stale = files.filter((entry) => {
      const normalized = String(entry).replace(/\/+$/, '');
      return !fs.existsSync(path.join(ROOT, normalized));
    });
    assert.deepEqual(stale, [], `files[] references paths that do not exist: ${stale.join(', ')}`);
  });

  test('the css and img directories contain only what is published', () => {
    const onDisk = [...listFiles(PATHS.CSS_DIR), ...listFiles(path.join(ROOT, 'img'))];
    const unpublished = onDisk.filter((file) => !isPublished(file, files));
    assert.deepEqual(unpublished, [], `assets present but not published: ${unpublished.join(', ')}`);
  });
});

test.describe('stylesheet reference safety', () => {
  for (const [name, css] of SHIPPED_STYLESHEETS) {
    test(`${name} contains no @import`, () => {
      const imports = extractImports(css);
      assert.deepEqual(imports, [], `@import pulls in code we neither review nor pin: ${imports.join(', ')}`);
    });

    test(`${name} contains no executable or script-bearing CSS`, () => {
      const forbidden = [
        ['expression(', 'IE expression() executes script'],
        ['-moz-binding', '-moz-binding attaches script to a selector'],
        ['behavior:', 'behavior: attaches HTC/script behavior'],
        ['javascript:', 'javascript: URL in a stylesheet'],
        ['@charset', '@charset in a minified build indicates a corrupted build'],
      ];
      for (const [needle, why] of forbidden) {
        assert.ok(!css.toLowerCase().includes(needle.toLowerCase()), `${name}: ${why}`);
      }
    });

    test(`${name} references no off-site or non-http URLs`, () => {
      const remote = extractUrls(css).filter(
        (url) => /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
      );
      assert.deepEqual(
        remote,
        [],
        `a stylesheet that reaches off-site turns every icon into a third-party request: ${remote.join(', ')}`
      );
    });

    test(`${name} references no data: URLs`, () => {
      const dataUrls = extractUrls(css).filter((url) => url.toLowerCase().startsWith('data:'));
      assert.deepEqual(
        dataUrls,
        [],
        `inline data: payloads in a stylesheet are unreviewable and grow unbounded: ${dataUrls.join(', ')}`
      );
    });

    test(`${name} keeps every url() inside the published package`, () => {
      const files = pkg.files ?? [];
      const escaping = [];
      for (const url of extractUrls(css)) {
        const absolute = path.resolve(PATHS.CSS_DIR, url);
        const inside = absolute === ROOT || absolute.startsWith(ROOT + path.sep);
        if (!inside) {
          escaping.push(`${url} escapes the package (${rel(absolute)})`);
          continue;
        }
        if (!isPublished(rel(absolute), files)) {
          escaping.push(`${url} resolves to ${rel(absolute)}, which is not in files[]`);
        }
      }
      assert.deepEqual(
        escaping,
        [],
        `url() references must stay inside the published pack:\n  ${escaping.join('\n  ')}`
      );
    });
  }

  test('the sprite referenced by both stylesheets is the same file', () => {
    const referenced = SHIPPED_STYLESHEETS.flatMap(([, css]) => extractUrls(css));
    assert.ok(referenced.length > 0, 'no sprite reference found in either stylesheet');
    assert.equal(new Set(referenced).size, 1, `stylesheets disagree on the sprite path: ${referenced.join(', ')}`);
  });
});

test.describe('repository secrets hygiene', () => {
  test('no committed environment file with real values', () => {
    const tracked = ['.env', '.env.local', '.env.production'];
    const committed = tracked.filter((name) => fs.existsSync(path.join(ROOT, name)));
    assert.deepEqual(committed, [], `commit these to .gitignore instead: ${committed.join(', ')}`);
  });

  test('package.json carries no publish credentials or registry override', () => {
    assert.equal(
      pkg.publishConfig?.registry,
      undefined,
      'pinning a private registry in publishConfig leaks infrastructure detail'
    );
    const serialized = JSON.stringify(pkg).toLowerCase();
    for (const needle of ['_authtoken', 'npm_token', 'password', 'secret']) {
      assert.ok(!serialized.includes(needle), `package.json appears to contain a ${needle} entry`);
    }
  });
});
