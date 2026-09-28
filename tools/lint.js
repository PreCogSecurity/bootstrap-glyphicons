#!/usr/bin/env node
'use strict';

/**
 * Zero-dependency linter for bootstrap-glyphicons.
 *
 * Why not ESLint or Prettier? Because this package is published to npm as a
 * static asset pack and promises consumers zero dependencies. Pulling a lint
 * toolchain in would add hundreds of transitive packages to a repository whose
 * entire security story is "there is no third-party code here", and would give
 * every future maintainer a dependency tree to audit for the privilege of
 * checking five small files.
 *
 * The rules below are the ones that actually matter for this repository:
 *   - correctness  : no syntax errors, no forgotten `test.only`, no `test.skip`
 *                    without a stated reason, no `eval`/`exec` of interpolated input
 *   - security     : no credential patterns, no core module imported without the
 *                    `node:` prefix (so a hostile `node_modules/path` cannot
 *                    shadow a builtin), no lifecycle script creep
 *   - consistency  : LF-ish whitespace hygiene, single trailing newline, JSON and
 *                    YAML that actually parse
 *
 * Usage: `npm run lint` (or `node tools/lint.js`)
 * Exit code 0 when clean, 1 when any rule is violated.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MAX_LINE_LENGTH = 120;

const JS_DIRS = ['tests', 'tools'];
const TEXT_EXTENSIONS = new Set(['.js', '.json', '.yml', '.yaml', '.md', '.conf', '.example', '']);
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.gif', '.ico', '.woff', '.woff2']);

// Files an attacker would target to leak a credential, scoped to text files
// we actually author. Deliberately excludes the test suite, which contains
// these very strings as negative fixtures.
const SECRET_SCAN_PATHS = [
  '.env.example',
  '.github',
  'CONTRIBUTING.md',
  'Dockerfile',
  'LICENSE.md',
  'README.md',
  'SECURITY.md',
  'css',
  'docker',
  'docker-compose.yml',
  'package.json',
];

const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, 'private key block'],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/, 'GitHub token'],
  [/\bnpm_[A-Za-z0-9]{20,}/, 'npm token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JSON Web Token'],
];

const problems = [];

function report(file, line, message) {
  problems.push(`${path.relative(ROOT, file)}:${line}  ${message}`);
}

/**
 * Read a text file with line endings normalised to LF.
 *
 * `.gitattributes` pins the repository to LF, but a Windows checkout made
 * before that change still has CRLF on disk. Normalising here keeps the linter
 * from reporting "trailing whitespace" for every line of an otherwise clean
 * file.
 */
function readNormalized(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function lintJavaScript(file) {
  // Authoritative syntax check: the same check `node --check` performs.
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) {
    report(file, 1, `syntax error: ${(checked.stderr || '').trim().split('\n').slice(0, 2).join(' ')}`);
    return;
  }

  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  const source = readNormalized(file);
  const lines = source.split('\n');

  // 'use strict' must be the first statement (a shebang may precede it).
  const strictStatement = source.replace(/^#![^\n]*\n/, '');
  if (!/^\s*(?:\/\*[\s\S]*?\*\/\s*)*'use strict';/.test(strictStatement)) {
    report(file, 1, "missing 'use strict' directive");
  }
  if (/\bvar\s+[A-Za-z_$]/.test(source)) {
    report(file, 1, 'use const/let instead of var');
  }

  lines.forEach((line, index) => {
    const number = index + 1;
    if (line.length > MAX_LINE_LENGTH) {
      report(file, number, `line is ${line.length} characters (max ${MAX_LINE_LENGTH})`);
    }
    if (/\s+$/.test(line)) {
      report(file, number, 'trailing whitespace');
    }
    if (line.includes('\t')) {
      report(file, number, 'tab character (this repository indents with spaces)');
    }
    // A forgotten focus silently skips every other test in the file, which is
    // exactly the kind of green CI that ships a broken sprite.
    if (/\b(?:test|it|describe)\.only\s*\(/.test(line)) {
      report(file, number, 'focused test left in place (.only skips the rest of the suite)');
    }
    if (/\b(?:test|it|describe)\.(?:skip|todo)\s*\(/.test(line) && !line.includes('//')) {
      report(file, number, 'skipped test without an inline reason');
    }
    if (/\beval\s*\(|new\s+Function\s*\(/.test(line)) {
      report(file, number, 'dynamic code execution (eval / new Function)');
    }
    if (/\.execSync\s*\(|\.exec\s*\(/.test(line)) {
      report(file, number, 'shell execution in a repository that should need none');
    }
    // Unprefixed core imports can be shadowed by a hostile package of the same
    // name in node_modules; `node:path` can never be.
    const bareRequire = line.match(/require\('([a-z][^':]*)'\)/);
    if (bareRequire) {
      report(file, number, `require('${bareRequire[1]}') should use the node: prefix`);
    }
  });

  // `relative` is POSIX-normalised, so compare against '/helpers/'.
  if (relative.startsWith('tests/') && !relative.includes('/helpers/') && !/\.test\.js$/.test(relative)) {
    report(file, 1, 'test files must be named *.test.js so `node --test` discovers them');
  }
}

function lintText(file, source) {
  const extension = path.extname(file);
  if (['.yml', '.yaml'].includes(extension) && /^\t/m.test(source)) {
    report(file, 1, 'YAML must be indented with spaces, not tabs');
  }
  if (source.length > 0 && !source.endsWith('\n')) {
    report(file, source.split('\n').length, 'file does not end with a newline');
  }
  if (/\n\n$/.test(source)) {
    report(file, source.split('\n').length, 'file ends with more than one blank line');
  }
  if (extension === '.json') {
    try {
      JSON.parse(source);
    } catch (error) {
      report(file, 1, `invalid JSON: ${error.message}`);
    }
  }
  source.split('\n').forEach((line, index) => {
    if (/\s+$/.test(line)) {
      report(file, index + 1, 'trailing whitespace');
    }
    if (line.length > MAX_LINE_LENGTH && extension !== '.js') {
      report(file, index + 1, `line is ${line.length} characters (max ${MAX_LINE_LENGTH})`);
    }
  });
}

function lintSecrets(file, source) {
  source.split('\n').forEach((line, index) => {
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        report(file, index + 1, `possible ${label} committed to the repository`);
      }
    }
  });
}

function main() {
  const tracked = walk(ROOT).filter((file) => {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (relative.startsWith('.git/') || relative.startsWith('node_modules/')) {
      return false;
    }
    return !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase());
  });

  let javascriptFiles = 0;
  let textFiles = 0;

  for (const file of tracked) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    const inJsDir = JS_DIRS.some((dir) => relative.startsWith(`${dir}/`));
    if (inJsDir && path.extname(file) === '.js') {
      lintJavaScript(file);
      javascriptFiles += 1;
      continue;
    }
    const extension = path.extname(file).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) {
      continue;
    }
    lintText(file, readNormalized(file));
    textFiles += 1;
  }

  const secretTargets = new Set(
    SECRET_SCAN_PATHS.flatMap((target) => {
      const full = path.join(ROOT, target);
      if (!fs.existsSync(full)) {
        return [];
      }
      return fs.statSync(full).isDirectory() ? walk(full) : [full];
    })
  );
  for (const file of secretTargets) {
    if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      continue;
    }
    lintSecrets(file, readNormalized(file));
  }

  if (problems.length > 0) {
    console.error(`lint: ${problems.length} problem(s)\n`);
    for (const problem of problems) {
      console.error(`  ${problem}`);
    }
    console.error('');
    process.exitCode = 1;
    return;
  }

  console.log(
    `lint: ${javascriptFiles} JavaScript file(s) and ${textFiles} text file(s) checked, no problems found.`
  );
}

main();
