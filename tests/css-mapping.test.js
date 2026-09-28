'use strict';

/**
 * Regression coverage for the CSS/sprite mapping.
 *
 * These are the tests that were previously squashed into a single ad-hoc
 * script. Splitting them into named `node:test` cases means a failure now says
 * *which* invariant broke, and CI can point at an exact test instead of
 * "some check failed".
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { PATHS, rel, readText } = require('./helpers/repo');
const { parseIconMapping, parseOffset, parseIconBox } = require('./helpers/css');

const minCss = readText(PATHS.MIN_CSS);
const srcCss = readText(PATHS.SRC_CSS);
const minMapping = parseIconMapping(minCss);
const srcMapping = parseIconMapping(srcCss);

test.describe('shipped stylesheets', () => {
  test('both stylesheets define a GLYPHICONS-scale icon set', () => {
    // The README promises "400+ GLYPHICONS". This floor catches a stylesheet
    // that was truncated by a bad minifier or a partial rebase.
    assert.ok(
      minMapping.size >= 400,
      `minified CSS only defines ${minMapping.size} icons, expected at least 400`
    );
    assert.ok(
      srcMapping.size >= 400,
      `source CSS only defines ${srcMapping.size} icons, expected at least 400`
    );
  });

  test('the base .icon-large rule pins the shared icon box and sprite', () => {
    const box = parseIconBox(minCss);
    assert.ok(box, 'minified CSS is missing the .icon-large base rule');
    assert.deepEqual(box, { width: 28, height: 28 });

    const tiles = 'the sprite would tile unless background-repeat is no-repeat';
    assert.match(minCss, /background-repeat\s*:\s*no-repeat/, `minified CSS: ${tiles}`);
    assert.match(minCss, /background-image\s*:\s*url\(/, 'minified CSS is missing the sprite background-image');
    assert.match(srcCss, /background-repeat\s*:\s*no-repeat/, `source CSS: ${tiles}`);
  });
});

test.describe('minified stylesheet', () => {
  test('every icon class has a non-empty background-position', () => {
    const missing = [...minMapping.entries()].filter(([, position]) => !position).map(([name]) => name);
    assert.deepEqual(missing, [], `icons without a sprite offset: ${missing.join(', ')}`);
  });

  test('every background-position is a pair of integer pixel offsets', () => {
    const invalid = [...minMapping.entries()]
      .filter(([, position]) => parseOffset(position) === null)
      .map(([name, position]) => `${name} => ${JSON.stringify(position)}`);
    assert.deepEqual(
      invalid,
      [],
      'unparseable background-position values (unitless or non-pixel): ' + invalid.join(', ')
    );
  });
});

test.describe('source and minified stylesheets agree', () => {
  test('they define exactly the same set of icon classes', () => {
    const missingFromMin = [...srcMapping.keys()].filter((name) => !minMapping.has(name));
    const extraInMin = [...minMapping.keys()].filter((name) => !srcMapping.has(name));
    assert.deepEqual(missingFromMin, [], `present in source CSS, missing from minified: ${missingFromMin.join(', ')}`);
    assert.deepEqual(extraInMin, [], `present in minified, missing from source: ${extraInMin.join(', ')}`);
  });

  test('they assign the same sprite offset to every shared icon class', () => {
    // The previous check only compared class *names*, so a hand-edited
    // minified file could point an icon at the wrong glyph and still pass.
    const mismatched = [];
    for (const [name, sourcePosition] of srcMapping) {
      const minifiedPosition = minMapping.get(name);
      if (minifiedPosition !== undefined && minifiedPosition !== sourcePosition) {
        mismatched.push(`${name}: source=${sourcePosition} min=${minifiedPosition}`);
      }
    }
    assert.deepEqual(mismatched, [], `sprite offsets drifted between builds:\n  ${mismatched.join('\n  ')}`);
  });
});

test.describe('stylesheet hygiene', () => {
  const stylesheets = [
    ['bootstrap.icon-large.css', srcCss],
    ['bootstrap.icon-large.min.css', minCss],
  ];

  for (const [name, css] of stylesheets) {
    test(`${name} declares a charset or is plain ASCII`, () => {
      // Non-ASCII bytes in a stylesheet are almost always an accidental
      // smart quote or a stray copy/paste; they also break byte-for-byte
      // diffing between the source and minified builds.
      assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(css), `${name} contains non-ASCII bytes`);
    });

    test(`${name} has no unbalanced braces`, () => {
      const open = (css.match(/\{/g) || []).length;
      const close = (css.match(/\}/g) || []).length;
      assert.equal(open, close, `${name} has ${open} '{' and ${close} '}'`);
    });
  }

  test('the source stylesheet is human-readable', () => {
    // Guards against someone "regenerating" the source file with the minifier.
    assert.match(srcCss, /\n/, 'source CSS is a single line; it is supposed to be the readable build');
    assert.ok(srcCss.length > minCss.length, 'source CSS should be larger than the minified build');
    assert.ok(!rel(PATHS.SRC_CSS).includes('min'), rel(PATHS.SRC_CSS));
  });
});
