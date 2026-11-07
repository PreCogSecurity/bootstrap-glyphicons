'use strict';

/**
 * Hardening invariants added after the 2026-11 quality assessment.
 *
 * The existing suites prove the assets and the packaging are correct. These
 * tests prove the *delivery* controls around them: the repository is classified
 * honestly, release history exists, CI cannot run mutable third-party code or
 * silently install dependencies, the preview server rejects abusive requests,
 * and generated inventory files are not committed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PATHS, ROOT, readText, readJson } = require('./helpers/repo');

const META_PATH = path.join(ROOT, '.repo-meta.json');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');

const meta = fs.existsSync(META_PATH) ? readJson(META_PATH) : {};
const changelog = fs.existsSync(CHANGELOG_PATH) ? readText(CHANGELOG_PATH) : '';
const workflow = readText(WORKFLOW_PATH);
const gitignore = readText(path.join(ROOT, '.gitignore'));
const nginxConf = readText(path.join(ROOT, 'docker', 'nginx.conf'));
const compose = readText(PATHS.COMPOSE_FILE);
const pkg = readJson(PATHS.PACKAGE_JSON);

/** Split a workflow into `jobName -> body` using direct children of `jobs:`. */
function jobBodies(source) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === 'jobs:');
  assert.notEqual(start, -1, 'CI workflow has no jobs: section');

  const bodies = new Map();
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const header = line.match(/^  ([a-z][a-z0-9-]*):\s*$/);
    if (header) {
      current = header[1];
      bodies.set(current, []);
      continue;
    }
    if (current) {
      bodies.get(current).push(line);
    }
  }
  return bodies;
}

test.describe('project classification', () => {
  test('machine-readable metadata declares a static asset library', () => {
    assert.ok(fs.existsSync(META_PATH), '.repo-meta.json is missing');
    assert.equal(meta.project_type, 'static-asset-library');
    assert.equal(meta.infrastructure_as_code, false);
    assert.equal(meta.runtime, 'none');
  });

  test('the manifest description states what the package is and is not', () => {
    assert.match(pkg.description, /static css\/sprite asset pack/i);
    assert.match(pkg.description, /no runtime|infrastructure/i);
  });
});

test.describe('release history', () => {
  test('CHANGELOG.md exists and follows Keep a Changelog', () => {
    assert.ok(fs.existsSync(CHANGELOG_PATH), 'CHANGELOG.md is missing');
    assert.match(changelog, /^# Changelog/m);
    assert.match(changelog, /^## \[Unreleased\]/m);
    assert.match(changelog, /keepachangelog\.com/i);
  });

  test('the current manifest version has an entry', () => {
    const escaped = pkg.version.replace(/\./g, '\\.');
    assert.match(changelog, new RegExp(`^## \\[${escaped}\\]`, 'm'));
  });
});

test.describe('CI supply-chain hardening', () => {
  test('every workflow action is pinned to a commit SHA', () => {
    const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)@(\S+)/gm)]
      .map((match) => ({ action: match[1], ref: match[2] }));
    assert.ok(uses.length > 0, 'CI workflow uses no actions');

    const mutable = uses.filter((use) => !/^[0-9a-f]{40}$/.test(use.ref));
    assert.deepEqual(mutable, [], `actions must pin a 40-character SHA: ${JSON.stringify(mutable)}`);
  });

  test('the workflow is least-privilege and does not persist credentials', () => {
    assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read/m);
    assert.match(workflow, /persist-credentials:\s*false/);
  });

  test('every install disables lifecycle scripts', () => {
    const installs = workflow
      .split('\n')
      .filter((line) => /^\s*run:\s*npm ci\b/.test(line));
    assert.ok(installs.length >= 2, 'expected an npm ci step in both jobs');

    const unsafe = installs.filter((line) => !line.includes('--ignore-scripts'));
    assert.deepEqual(unsafe, [], `npm ci must pass --ignore-scripts: ${unsafe.join('; ')}`);
  });

  test('every job is bounded by a timeout', () => {
    const jobs = jobBodies(workflow);
    assert.ok(jobs.size >= 2, 'CI workflow should define lint and test jobs');
    for (const [name, body] of jobs) {
      assert.match(body.join('\n'), /timeout-minutes:\s*\d+/, `CI job ${name} has no timeout`);
    }
  });

  test('the dependency inventory is published as an artifact', () => {
    assert.match(workflow, /npm ls --all --json > sbom\.json/);
    assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
    assert.match(workflow, /path:\s*sbom\.json/);
  });
});

test.describe('preview hardening', () => {
  test('nginx rejects methods other than GET and HEAD', () => {
    assert.match(nginxConf, /limit_except\s+GET\s*\{[^}]*deny\s+all\s*;/);
  });

  test('nginx bounds request bodies, headers and timeouts', () => {
    assert.match(nginxConf, /client_max_body_size\s+\d+[kKmM]?;/);
    assert.match(nginxConf, /client_header_timeout\s+\d+s;/);
    assert.match(nginxConf, /large_client_header_buffers\s+\d+\s+\d+k;/);
  });

  test('nginx compresses CSS responses', () => {
    assert.match(nginxConf, /gzip\s+on;/);
    assert.match(nginxConf, /gzip_types\s+text\/css;/);
  });

  test('compose caps processes and rotates container logs', () => {
    assert.match(compose, /pids_limit:\s*\d+/);
    assert.match(compose, /max-size:/);
    assert.match(compose, /max-file:/);
  });

  test('generated SBOM output is not committed', () => {
    assert.match(gitignore, /^\/?sbom\.json$/m);
  });
});
