'use strict';

/**
 * A deliberately small, strict CSS reader for the two stylesheets this package
 * ships. It is not a browser-grade parser; it extracts exactly the constructs
 * the pack depends on (icon class -> sprite offset, and `url()` references)
 * and refuses anything it does not understand so a malformed or hostile
 * stylesheet fails the suite instead of slipping through.
 */

const ICON_CLASS_RE = /\.icon-large\.icon-([a-z0-9-]+)/g;
const POSITION_RE = /background-position\s*:\s*([^;}]+)/;
const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/g;
const IMPORT_RE = /@import\s+([^;]+);/g;

// A `background-position` must be exactly two lengths.
const OFFSET_TOKEN_RE = /^(-?\d+)(px)?$/;

/**
 * Parse a stylesheet into `Map<iconName, backgroundPosition>`.
 * Handles comma-separated selector lists, e.g.
 *   `.icon-large.icon-airplane, .icon-large.icon-plane { background-position: 0 -1262px; }`
 * and declarations with or without a trailing semicolon.
 */
function parseIconMapping(css) {
  const mapping = new Map();
  for (const rule of css.split('}')) {
    const positionMatch = rule.match(POSITION_RE);
    if (!positionMatch) {
      continue;
    }
    const position = positionMatch[1].trim();
    const braceIndex = rule.indexOf('{');
    if (braceIndex === -1) {
      continue;
    }
    const selectorList = rule.slice(0, braceIndex);
    for (const match of selectorList.matchAll(ICON_CLASS_RE)) {
      mapping.set(match[1], position);
    }
  }
  return mapping;
}

/**
 * Parse a `background-position` value into `{ x, y }` pixel offsets.
 * Returns `null` when the value is not a valid pair of lengths, which callers
 * treat as a hard failure rather than something to coerce.
 */
function parseOffset(position) {
  const tokens = String(position).trim().split(/\s+/);
  if (tokens.length !== 2) {
    return null;
  }
  const parsed = [];
  for (const token of tokens) {
    const match = token.match(OFFSET_TOKEN_RE);
    if (!match) {
      return null;
    }
    // CSS permits a unitless zero (which is how Bootstrap's own sprite rules
    // are written, e.g. `0 -34px`); a unitless non-zero is invalid.
    if (!match[2] && Number(match[1]) !== 0) {
      return null;
    }
    parsed.push(Number(match[1]));
  }
  return { x: parsed[0], y: parsed[1] };
}

/**
 * Read the base `.icon-large` rule and return the icon box dimensions in
 * pixels, e.g. `{ width: 28, height: 28 }`.
 *
 * This is read from the stylesheet rather than hardcoded in the test so that
 * if someone resizes the icon box, the sprite bounds checks automatically
 * follow the new value instead of quietly passing against stale numbers.
 */
function parseIconBox(css) {
  const rule = css.match(/\.icon-large\s*\{([^}]*)\}/);
  if (!rule) {
    return null;
  }
  const width = rule[1].match(/(?:^|;)\s*width\s*:\s*(\d+)px\s*(?:;|$)/);
  const height = rule[1].match(/(?:^|;)\s*height\s*:\s*(\d+)px\s*(?:;|$)/);
  if (!width || !height) {
    return null;
  }
  return { width: Number(width[1]), height: Number(height[1]) };
}

/** Every `url()` target in a stylesheet, in source order, de-duplicated. */
function extractUrls(css) {
  const urls = [];
  for (const match of css.matchAll(URL_RE)) {
    const value = match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3];
    urls.push(value.trim());
  }
  return [...new Set(urls)];
}

/** Every `@import` target in a stylesheet, in source order, de-duplicated. */
function extractImports(css) {
  const imports = [];
  for (const match of css.matchAll(IMPORT_RE)) {
    imports.push(match[1].trim().replace(/^["']|["']$/g, ''));
  }
  return [...new Set(imports)];
}

module.exports = {
  parseIconMapping,
  parseOffset,
  parseIconBox,
  extractUrls,
  extractImports,
};
