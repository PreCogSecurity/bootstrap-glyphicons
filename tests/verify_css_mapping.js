#!/usr/bin/env node
'use strict';

/**
 * Regression check for the bootstrap-glyphicons CSS/sprite mapping.
 *
 * Verifies that:
 *   1. Every `.icon-large.icon-<name>` class in the minified stylesheet has a
 *      matching `background-position` rule (i.e. no icon class is left without
 *      a sprite offset).
 *   2. The unminified and minified stylesheets define the same set of icon
 *      classes, so the shipped minified file never drifts from the source.
 *   3. The sprite image referenced by the stylesheets (`../img/glyphicons.png`)
 *      exists and is a valid, non-empty PNG.
 *
 * Usage: `npm test` (or `node tests/verify_css_mapping.js`)
 * Exit code 0 on success, 1 on any failure.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const MIN_CSS = path.join(CSS_DIR, 'bootstrap.icon-large.min.css');
const SRC_CSS = path.join(CSS_DIR, 'bootstrap.icon-large.css');

const ICON_CLASS_RE = /\.icon-large\.icon-([a-z0-9-]+)/g;
const POSITION_RE = /background-position\s*:\s*([^;}]+)/;
const SPRITE_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/;

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function readCss(file) {
  if (!fs.existsSync(file)) {
    fail(`missing stylesheet: ${path.relative(ROOT, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

/**
 * Parse a stylesheet into a Map of icon name -> background-position.
 * Handles comma-separated selector lists, e.g.
 *   `.icon-large.icon-airplane, .icon-large.icon-plane { background-position: 0 -1262px; }`
 * and rules whose declaration lacks a trailing semicolon.
 */
function parseIconMapping(css) {
  const mapping = new Map();
  for (const rule of css.split('}')) {
    const positionMatch = rule.match(POSITION_RE);
    if (!positionMatch) {
      continue;
    }
    const position = positionMatch[1].trim();
    const selectorList = rule.slice(0, rule.indexOf('{'));
    for (const match of selectorList.matchAll(ICON_CLASS_RE)) {
      mapping.set(match[1], position);
    }
  }
  return mapping;
}

/**
 * Resolve the sprite path referenced by a stylesheet's background-image url().
 */
function resolveSpritePath(cssFile, css) {
  const urlMatch = css.match(SPRITE_URL_RE);
  if (!urlMatch) {
    fail(`no background-image url() found in ${path.relative(ROOT, cssFile)}`);
    return null;
  }
  return path.resolve(path.dirname(cssFile), urlMatch[1]);
}

/**
 * Check that the sprite file exists and is a valid, non-empty PNG.
 * Follows symlinks (the repo ships `img/glyphicons.png` as a symlink to the
 * root sprite) and also tolerates checkouts where git materialized the symlink
 * as a text file containing the target path (Windows, core.symlinks=false).
 */
function checkSprite(spritePath) {
  if (!spritePath) {
    return;
  }
  const relative = path.relative(ROOT, spritePath);
  if (!fs.existsSync(spritePath)) {
    fail(`sprite referenced by CSS does not exist: ${relative}`);
    return;
  }
  const stat = fs.statSync(spritePath); // follows symlinks
  if (!stat.isFile()) {
    fail(`sprite is not a regular file: ${relative}`);
    return;
  }
  if (stat.size === 0) {
    fail(`sprite is empty: ${relative}`);
    return;
  }
  const buffer = fs.readFileSync(spritePath);
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  if (isPng) {
    console.log(`OK: sprite ${relative} is a ${stat.size}-byte PNG`);
    return;
  }
  // Possibly a symlink checked out as a text file (core.symlinks=false).
  const text = buffer.toString('utf8').trim();
  if (/^\.{0,2}[\\/]?[^\\/\r\n]+$/.test(text)) {
    const resolved = path.resolve(path.dirname(spritePath), text);
    if (fs.existsSync(resolved)) {
      checkSprite(resolved);
      return;
    }
  }
  fail(`sprite is not a valid PNG (missing magic bytes): ${relative}`);
}

// --- 1. Every icon class in the minified CSS has a background-position ------
const minCss = readCss(MIN_CSS);
const minMapping = parseIconMapping(minCss);
if (minMapping.size === 0) {
  fail(`no icon mappings found in ${path.relative(ROOT, MIN_CSS)}`);
} else {
  console.log(`OK: ${minMapping.size} icon classes parsed from minified CSS`);
  for (const [name, position] of minMapping) {
    if (!position) {
      fail(`icon-${name} has no background-position`);
    }
  }
}

// --- 2. Minified and source stylesheets agree on the icon set ---------------
const srcCss = readCss(SRC_CSS);
const srcMapping = parseIconMapping(srcCss);
const srcNames = new Set(srcMapping.keys());
const minNames = new Set(minMapping.keys());
for (const name of srcNames) {
  if (!minNames.has(name)) {
    fail(`minified CSS is missing icon-${name} (present in source CSS)`);
  }
}
for (const name of minNames) {
  if (!srcNames.has(name)) {
    fail(`minified CSS has extra icon-${name} (not present in source CSS)`);
  }
}
console.log(`OK: source and minified CSS agree on ${srcNames.size} icon classes`);

// --- 3. The sprite referenced by the CSS exists and is a valid PNG ----------
checkSprite(resolveSpritePath(MIN_CSS, minCss));
checkSprite(resolveSpritePath(SRC_CSS, srcCss));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll CSS/sprite mapping checks passed.');