# Contributing

Thanks for helping improve bootstrap-glyphicons. This is a small static asset
pack, so the contribution workflow is intentionally light.

## How to add or fix an icon mapping

1. Edit `css/bootstrap.icon-large.css` (the readable source of truth).
   Each icon rule looks like:

   ```css
   .icon-large.icon-glass { background-position: 0 0; }
   ```

   The class name should follow the GLYPHICONS file name from the official
   zip whenever possible (see the README).

2. Keep `css/bootstrap.icon-large.min.css` in sync. Either regenerate it with
   your minifier of choice, or apply the same change to the minified file by
   hand. The verification test will tell you if the two files disagree.

3. Run the verification test:

   ```sh
   npm test
   ```

   The test asserts that:
   - every `.icon-large.icon-<name>` class has a `background-position` rule,
   - the minified and source stylesheets define the same icon set,
   - the sprite referenced by the CSS (`img/glyphicons.png`) exists and is a
     valid, non-empty PNG.

   The test must pass (exit code 0) before the change is ready.

4. Commit the CSS change **together with the test run** in one small, focused
   commit. Do not mix formatting changes, unrelated fixes, or new icons into
   the same commit — each icon set or fix should be its own commit so the
   history stays reviewable.

## Reporting issues

Open an issue describing the problem. For a broken icon mapping, include the
icon class name, the expected glyph, and (if possible) the sprite offset that
should be used.

## Code of conduct

Be respectful and constructive. This project is maintained by volunteers.