'use strict';

/**
 * Minimal PNG reader used to validate the GLYPHICONS sprite.
 *
 * The sprite is the only binary this package ships and it is loaded directly by
 * a browser, so the suite checks more than "file exists": it verifies the PNG
 * container is structurally intact (signature, IHDR, IEND) and exposes the
 * pixel dimensions so icon offsets can be bounds-checked against the real
 * image instead of against a hardcoded constant.
 */

const fs = require('node:fs');
const path = require('node:path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read a PNG's header. Returns `null` when the file is not a PNG; throws when
 * the bytes claim to be a PNG but are structurally broken (which would make the
 * browser render a broken image while still passing a magic-byte check).
 */
function readPngHeader(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${file}: first chunk is not IHDR`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) {
    throw new Error(`${file}: sprite has a zero dimension (${width}x${height})`);
  }
  // Walk the chunk list to confirm the stream terminates with IEND.
  let offset = 8;
  let sawIend = false;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    offset += 12 + length;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }
  if (!sawIend) {
    throw new Error(`${file}: PNG chunk stream has no IEND terminator`);
  }
  return { width, height, bitDepth: buffer[24], colorType: buffer[25], bytes: buffer.length };
}

/**
 * Resolve `img/glyphicons.png` to the file that actually holds sprite bytes.
 *
 * The repository ships that path as a symlink to `../glyphicons.png`. Git
 * checkouts on Windows with `core.symlinks=false` (the default without
 * Developer Mode) materialise the symlink as a *text file containing the link
 * target*, so both shapes have to be accepted or the suite would only pass on
 * Unix.
 */
function resolveSprite(fromFile) {
  const stats = fs.lstatSync(fromFile);
  if (stats.isSymbolicLink()) {
    return fs.realpathSync(fromFile);
  }
  const contents = fs.readFileSync(fromFile, 'utf8').trim();
  if (/^\.{0,2}[\\/]?[^\\/\r\n]+$/.test(contents)) {
    const candidate = path.resolve(path.dirname(fromFile), contents);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.realpathSync(candidate);
    }
  }
  return fs.realpathSync(fromFile);
}

module.exports = { readPngHeader, resolveSprite };
