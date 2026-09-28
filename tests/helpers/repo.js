'use strict';

/**
 * Shared repository paths and read-only filesystem helpers for the
 * bootstrap-glyphicons verification suite.
 *
 * Everything here is deliberately dependency-free and read-only: this package
 * is published to npm purely as a static asset pack, so the test tooling must
 * never add install-time code to a consumer's machine. Every path is resolved
 * absolutely from the repository root so the suite behaves identically from a
 * fresh clone, from `npm test`, and from CI.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const PATHS = {
  ROOT,
  CSS_DIR: path.join(ROOT, 'css'),
  MIN_CSS: path.join(ROOT, 'css', 'bootstrap.icon-large.min.css'),
  SRC_CSS: path.join(ROOT, 'css', 'bootstrap.icon-large.css'),
  SPRITE: path.join(ROOT, 'glyphicons.png'),
  SPRITE_LINK: path.join(ROOT, 'img', 'glyphicons.png'),
  README: path.join(ROOT, 'README.md'),
  CONTRIBUTING: path.join(ROOT, 'CONTRIBUTING.md'),
  LICENSE: path.join(ROOT, 'LICENSE.md'),
  PACKAGE_JSON: path.join(ROOT, 'package.json'),
  PACKAGE_LOCK: path.join(ROOT, 'package-lock.json'),
  DOCKERFILE: path.join(ROOT, 'Dockerfile'),
  DOCKERIGNORE: path.join(ROOT, '.dockerignore'),
  COMPOSE_FILE: path.join(ROOT, 'docker-compose.yml'),
  ENV_EXAMPLE: path.join(ROOT, '.env.example'),
  NVMRC: path.join(ROOT, '.nvmrc'),
};

/**
 * Render an absolute path as a repository-relative POSIX path so assertion
 * messages are identical on Windows, macOS and Linux.
 */
function rel(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join('/');
}

/**
 * Read a UTF-8 text file. Unlike `fs.readFileSync(file, 'utf8') || ''` this
 * never degrades a read failure into an empty string, which would let a
 * missing asset look like a valid (empty) one.
 */
function readText(absolutePath) {
  return fs.readFileSync(absolutePath, 'utf8');
}

function exists(absolutePath) {
  return fs.existsSync(absolutePath);
}

function isFile(absolutePath) {
  try {
    return fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

function readJson(absolutePath) {
  return JSON.parse(readText(absolutePath));
}

/**
 * Recursively list files under `dir`, returned as sorted repository-relative
 * POSIX paths. Symbolic links are listed (and later stat'ed) rather than
 * silently skipped, because this repo ships one on purpose.
 */
function listFiles(dir, options = {}) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if ((options.skipDirs || []).includes(entry.name)) {
          continue;
        }
        walk(path.join(current, entry.name));
        continue;
      }
      results.push(rel(path.join(current, entry.name)));
    }
  };
  walk(dir);
  return results.sort();
}

module.exports = { PATHS, ROOT, rel, readText, exists, isFile, readJson, listFiles };
