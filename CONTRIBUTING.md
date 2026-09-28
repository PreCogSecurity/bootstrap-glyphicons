# Contributing

Thanks for helping improve bootstrap-glyphicons. This is a small static asset
pack, so the contribution workflow is intentionally light — but it is also
zero-dependency, so there is nothing to install before you start.

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
   hand. The verification suite will tell you if the two files disagree —
   including when an offset, not just a class name, drifted.

3. Run the checks. Both must pass (exit code 0) before the change is ready:

   ```sh
   npm test
   npm run lint
   ```

   `npm test` asserts that:

   - every `.icon-large.icon-<name>` class has a `background-position` rule
     expressed as integer pixel offsets,
   - the minified and source stylesheets define the same icon classes **at the
     same offsets**,
   - the sprite referenced by the CSS (`img/glyphicons.png`) exists and is a
     structurally valid PNG,
   - no icon offset points past the edge of the sprite (such an icon renders
     blank in a browser, with no error anywhere),
   - the published tarball still has no dependencies, no install scripts, and
     no `url()` that leaves the package,
   - the Docker preview still runs non-root and serves the assets where the CSS
     expects them,
   - the README, `docker-compose.yml` and `.env.example` still agree.

   `npm run lint` checks JavaScript syntax and repository hygiene, and scans the
   configuration files for committed credential patterns.

4. Commit the CSS change **together with the test run** in one small, focused
   commit. Do not mix formatting changes, unrelated fixes, or new icons into
   the same commit — each icon set or fix should be its own commit so the
   history stays reviewable.

## House rules

- **Stay dependency-free.** Do not add anything to `dependencies` or
  `devDependencies`. The suite runs on Node's built-in `node:test` and the
  linter is a single file in `tools/`. A dependency here is third-party code in
  every consumer's install, and `tests/published-package.test.js` will fail on
  it.
- **Keep the CSS self-contained.** No `@import`, no off-site `url()`, no `data:`
  URLs, and no `url()` that resolves outside the published files. A stylesheet
  that reaches a third party turns every icon into someone else's request.
- **Do not add lifecycle scripts** (`preinstall`, `postinstall`, `prepare`, …).
  They execute on a consumer's machine.
- Match the surrounding style: two-space indent, `const` over `let`/`var`,
  `require('node:…')` with the `node:` prefix, `'use strict'` at the top of
  every file, and lines under 120 characters.

## Reporting issues

Open an issue describing the problem. For a broken icon mapping, include the
icon class name, the expected glyph, and (if possible) the sprite offset that
should be used.

If you believe you have found a security vulnerability, do **not** open a public
issue. Follow the private reporting instructions in [SECURITY.md](SECURITY.md).

## Code of conduct

Be respectful and constructive. This project is maintained by volunteers.
