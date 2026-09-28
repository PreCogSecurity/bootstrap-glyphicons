'use strict';

/**
 * Documentation and environment-configuration consistency.
 *
 * A static asset pack lives or dies on its README: if the install steps or the
 * attribution requirement drift from reality, the project's licence compliance
 * breaks before anyone notices. These checks keep the prose honest and keep
 * `docker-compose.yml` and `.env.example` from disagreeing about variable
 * names — a mismatch there fails silently, because Compose expands an unknown
 * `${VAR}` to an empty string and then publishes an unprivileged container on
 * the wrong port.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PATHS, ROOT, rel, readText, readJson } = require('./helpers/repo');

const readme = readText(PATHS.README);
const contributing = readText(PATHS.CONTRIBUTING);
const license = readText(PATHS.LICENSE);
const compose = readText(PATHS.COMPOSE_FILE);
const securityPolicy = fs.existsSync(path.join(ROOT, 'SECURITY.md')) ? readText(path.join(ROOT, 'SECURITY.md')) : '';
const pkg = readJson(PATHS.PACKAGE_JSON);

/** Inline and reference-style Markdown link targets, ignoring anchors/URLs. */
function markdownLinks(markdown) {
  const targets = [];
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    targets.push(match[1]);
  }
  return targets.filter((target) => !/^(https?:|mailto:|#)/i.test(target));
}

test.describe('README', () => {
  test('declares the project type so tooling does not misclassify it', () => {
    assert.match(
      readme,
      /(?:^|\n)(?:#{1,4}\s+Project Type|Project Type\s*\n-{3,})/,
      'README must have a "Project Type" section'
    );
    assert.match(readme, /static (CSS\/image )?asset pack/i);
    assert.match(
      readme,
      /not .*(infrastructure|application code)|contains no (application|infrastructure) code/i,
      'README should state plainly that this is not an application or infrastructure project'
    );
  });

  test('documents every npm script it ships', () => {
    // `test` is documented as `npm test` rather than `npm run test`; the rest
    // must appear verbatim so a contributor can discover them from the README.
    const scripts = Object.keys(pkg.scripts ?? {}).filter((script) => script !== 'test');
    for (const script of scripts) {
      assert.ok(readme.includes(`npm run ${script}`), `README does not document \`npm run ${script}\``);
    }
    assert.ok(readme.includes('npm test'), 'README does not document `npm test`');
  });

  test('keeps the required GLYPHICONS attribution', () => {
    // CC BY 3.0 requires visible attribution to glyphicons.com unless a
    // commercial licence was purchased. Losing this line is a licence breach.
    assert.match(readme, /glyphicons\.com/i);
    assert.match(license, /glyphicons/i, 'LICENSE.md no longer mentions GLYPHICONS');
    assert.match(license, /Attribution/i, 'LICENSE.md no longer states the attribution requirement');
  });

  test('links only to files that exist', () => {
    const broken = markdownLinks(readme)
      .filter((target) => !target.includes('#'))
      .map((target) => target.split('#')[0])
      .filter((target) => target && !fs.existsSync(path.resolve(ROOT, decodeURI(target))));
    assert.deepEqual(broken, [], `README links to missing paths: ${broken.join(', ')}`);
  });

  test('documents the preview server and its default port', () => {
    assert.match(readme, /docker compose up/i, 'README should show how to start the preview');
    const envExample = readText(PATHS.ENV_EXAMPLE);
    const port = envExample.match(/^PORT=(\d+)/m);
    assert.ok(port, '.env.example must declare PORT');
    assert.ok(readme.includes(`localhost:${port[1]}`), `README should document the preview at localhost:${port[1]}`);
  });
});

test.describe('CONTRIBUTING.md', () => {
  test('requires contributors to run the suite before committing', () => {
    assert.ok(contributing.includes('npm test'), 'CONTRIBUTING must require `npm test`');
    assert.ok(contributing.includes('npm run lint'), 'CONTRIBUTING must require `npm run lint`');
  });

  test('links only to files that exist', () => {
    const broken = markdownLinks(contributing)
      .map((target) => target.split('#')[0])
      .filter((target) => target && !fs.existsSync(path.resolve(ROOT, decodeURI(target))));
    assert.deepEqual(broken, [], `CONTRIBUTING links to missing paths: ${broken.join(', ')}`);
  });
});

test.describe('SECURITY.md', () => {
  test('gives consumers a reporting path', () => {
    assert.ok(securityPolicy, 'SECURITY.md is missing; consumers have no way to report a vulnerability');
    assert.match(securityPolicy, /report/i);
    assert.match(securityPolicy, /securityadvisories|security\/advisories|@[\w.-]+/i);
  });

  test('states the zero-dependency guarantee it actually provides', () => {
    assert.match(securityPolicy, /no (runtime |production )?dependenc|zero-dependenc/i);
  });
});

test.describe('environment configuration', () => {
  const envExamplePath = PATHS.ENV_EXAMPLE;
  const envExample = readText(envExamplePath);

  const declaredVars = [...envExample.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]);
  const composeVars = new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?::-[^}]*)?\}/g)].map((m) => m[1]));
  const readmeVars = new Set([...readme.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)].map((m) => m[1]));

  test('.env.example exists and is committed as a template, not as real values', () => {
    assert.ok(envExample.length > 0, `${rel(envExamplePath)} is empty`);
    assert.match(envExample, /^#/, '.env.example should start with explanatory comments');
    assert.ok(!fs.existsSync(path.join(ROOT, '.env')), 'a real .env must never be committed');
  });

  test('every variable docker-compose.yml interpolates is declared in .env.example', () => {
    const undeclared = [...composeVars].filter((name) => !declaredVars.includes(name));
    assert.deepEqual(
      undeclared,
      [],
      `compose interpolates variables missing from .env.example: ${undeclared.join(', ')}`
    );
  });

  test('every variable in .env.example is actually used', () => {
    const unused = declaredVars.filter((name) => !composeVars.has(name));
    assert.deepEqual(
      unused,
      [],
      `.env.example documents variables docker-compose.yml never reads: ${unused.join(', ')}`
    );
  });

  test('every variable is documented in the README', () => {
    const undocumented = declaredVars.filter((name) => !readmeVars.has(name));
    assert.deepEqual(undocumented, [], `README does not document: ${undocumented.join(', ')}`);
  });

  test('no template value looks like a real credential', () => {
    for (const line of envExample.split('\n')) {
      if (line.trim().startsWith('#') || !line.includes('=')) {
        continue;
      }
      const [, value = ''] = line.split('=', 2);
      assert.ok(
        !/(secret|password|token|api[_-]?key)\s*=\s*\S/i.test(line),
        `.env.example appears to contain a credential value: ${line}`
      );
      assert.ok(
        value.trim().length > 0,
        `.env.example declares an empty value for ${line.split('=')[0]}`
      );
    }
  });

  test('the template ships defaults that match the compose fallbacks', () => {
    // A mismatch here is the classic "it worked on my machine" failure: the
    // template says 8080, the compose default says 9090, and the port the
    // README documents serves nothing.
    const fallbacks = [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):-([^}]*)\}/g)].map((m) => [m[1], m[2]]);
    for (const [name, fallback] of fallbacks) {
      const documented = envExample.match(new RegExp(`^${name}=(.*)$`, 'm'));
      assert.ok(documented, `.env.example does not declare ${name}`);
      assert.equal(documented[1].trim(), fallback, `${name} in .env.example does not match the compose default`);
    }
  });
});
