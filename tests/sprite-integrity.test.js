'use strict';

/**
 * Integrity checks for the GLYPHICONS sprite.
 *
 * The sprite is a single opaque binary that every consumer's browser loads. A
 * truncated sprite, an out-of-sync copy, or an icon offset that points past the
 * edge of the image all render as a *silently missing icon* on someone else's
 * production site — the worst possible failure mode for an asset pack, because
 * there is no exception and no console error. These tests turn those failures
 * into red CI.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { PATHS, rel, readText } = require('./helpers/repo');
const { parseIconMapping, parseOffset, parseIconBox } = require('./helpers/css');
const { readPngHeader } = require('./helpers/sprite');

const minCss = readText(PATHS.MIN_CSS);
const box = parseIconBox(minCss);
const spriteHeader = readPngHeader(PATHS.SPRITE);

test('the sprite is a structurally valid PNG', () => {
  assert.ok(spriteHeader, `${rel(PATHS.SPRITE)} is not a PNG (missing signature)`);
  assert.ok(spriteHeader.bitDepth > 0, 'PNG has no bit depth');
  assert.ok(spriteHeader.bytes > 1024, `sprite looks truncated (${spriteHeader.bytes} bytes)`);
});

test('img/glyphicons.png is a byte-identical copy of the sprite', () => {
  // Both stylesheets hardcode `../img/glyphicons.png`. That path must be a real
  // file rather than a symlink: npm omits symlinks from the published tarball,
  // which would leave the shipped CSS pointing at a missing sprite.
  assert.ok(fs.existsSync(PATHS.SPRITE_LINK), `${rel(PATHS.SPRITE_LINK)} is missing`);
  assert.ok(
    fs.lstatSync(PATHS.SPRITE_LINK).isFile(),
    `${rel(PATHS.SPRITE_LINK)} must be a regular file so npm publishes it`
  );
  const mirror = fs.readFileSync(PATHS.SPRITE_LINK);
  const sprite = fs.readFileSync(PATHS.SPRITE);
  assert.ok(mirror.equals(sprite), `${rel(PATHS.SPRITE_LINK)} is out of sync with ${rel(PATHS.SPRITE)}`);
  assert.ok(readPngHeader(PATHS.SPRITE_LINK), `${rel(PATHS.SPRITE_LINK)} does not contain PNG bytes`);
});

test('the sprite is large enough to hold every declared icon offset', () => {
  assert.ok(box, 'cannot determine the icon box size from .icon-large');
  const mapping = parseIconMapping(minCss);

  // CSS `background-position: -x -y` shifts the sprite up and to the left, so
  // the element displays the sprite region starting at (|x|, |y|). An offset
  // beyond the sprite edge silently renders an empty box.
  const overflow = [];
  for (const [name, position] of mapping) {
    const offset = parseOffset(position);
    if (!offset) {
      continue; // reported by the css-mapping suite
    }
    const right = Math.abs(offset.x) + box.width;
    const bottom = Math.abs(offset.y) + box.height;
    if (right > spriteHeader.width || bottom > spriteHeader.height) {
      overflow.push(
        `${name} at ${position} needs ${right}x${bottom}, sprite is ${spriteHeader.width}x${spriteHeader.height}`
      );
    }
  }
  assert.deepEqual(overflow, [], `icons that would render blank:\n  ${overflow.join('\n  ')}`);
});

test('the sprite keeps headroom for future icons', () => {
  // A sprite that is exactly full today means the next icon added has nowhere
  // to go and someone will "fix" it by shrinking an existing offset. Requiring
  // a little slack turns that into a visible, early failure.
  const mapping = parseIconMapping(minCss);
  const maxRight = Math.max(
    ...[...mapping.values()].map((p) => Math.abs(parseOffset(p)?.x ?? 0) + box.width)
  );
  const maxBottom = Math.max(
    ...[...mapping.values()].map((p) => Math.abs(parseOffset(p)?.y ?? 0) + box.height)
  );
  assert.ok(
    spriteHeader.width - maxRight >= 8 || spriteHeader.height - maxBottom >= 8,
    `sprite is packed to the edge (${maxRight}/${spriteHeader.width} wide, ` +
      `${maxBottom}/${spriteHeader.height} tall); leave room for the next icon ` +
      'instead of reusing offsets'
  );
});
