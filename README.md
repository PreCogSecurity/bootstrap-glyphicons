Bootstrap Glyphicons Support
============================

Project Type
------------

This repository is a **static CSS/image asset pack** for
[Twitter's Bootstrap v2](http://twitter.github.com/bootstrap). It is not an
application and it is not infrastructure code: there is no runtime, no server
component, no infrastructure-as-code, and no third-party dependency. It ships
three deliverables — a stylesheet that adds `icon-large` classes, a PNG sprite
with the 400+ GLYPHICONS, and the verification tooling that keeps the CSS/sprite
mapping correct.

If you are looking for deploy targets, module boundaries, or infrastructure
configuration, this repository is not it. It is a stylesheet and a sprite.

Repository layout
-----------------

    css/bootstrap.icon-large.css      Readable source of the icon mapping
    css/bootstrap.icon-large.min.css  Minified stylesheet (the shipped file)
    docker/nginx.conf                 Server config for the local preview
    glyphicons.png                    The GLYPHICONS sprite
    img/glyphicons.png                Symlink to the sprite (matches the
                                      ../img/glyphicons.png URL in the CSS)
    tests/*.test.js                   Verification suite (node:test)
    tools/lint.js                     Zero-dependency linter
    package.json                      Scripts and published file list

About
-----

[Twitter's Bootstrap v2](http://twitter.github.com/bootstrap) project already
uses GLYPHICONS halflings (created by [Jan Kovařík](http://glyphicons.com/))
and are released for Bootstrap under the Apache 2.0 License. What this project
aims to accomplish is add seamless support for the 400+ GLYPHICONS (available
for free under the
[Creative Commons Attribution 3.0 Unported (CC BY 3.0)](http://creativecommons.org/licenses/by/3.0/deed.en)
license) to Bootstrap so "large" icons can be used. To achieve this I've
combined the over 400 24x24 GLYPHICONS in to a Sprite and added icon-large
definitions.

Whenever possible larger GLYPHICONS halflings names have been mapped.
Otherwise the CSS class definition follows the names set by the files in the
zip.

To use this within your site you **NEED** to do the following:

 1. Download `bootstrap.icon-large.min.css` and place it in the same directory
    as bootstrap.css file
 2. Download `glyphicons.png` and place it in the same directory as
    glyphicons-halflings.png
 3. Add the following CSS definition under the bootstrap.css call
    `<link href="css/bootstrap.icon-large.min.css" rel="stylesheet">`
 4. Clearly visible on the site (like the footer) add a link to
    [glyphicons.com](http://www.glyphicons.com/). This is a
    [requirement by the artist](http://glyphicons.com/glyphicons-licenses/)
    unless you purchase the GLYPHICONS ALL or GLYPHICONS PRO plans. If you
    don't want to give attribution to the artist, at least pay him for his
    fantastic work.

That's it. You can find an entire listing of all the GLYPHICONS

Installation
------------

Most consumers copy the two files into their own static asset pipeline. If you
would rather take the files straight from npm:

```sh
npm pack bootstrap-glyphicons
```

The tarball contains `css/`, `img/glyphicons.png`, `glyphicons.png`, this
README and the licence — and nothing else. There are no dependencies to audit
and no install scripts that execute on your machine.

Testing
-------

The repository ships a zero-dependency verification suite built on Node's
built-in `node:test` runner. Clone the repository and run it directly; there is
nothing to install.

```sh
npm test
```

It covers five areas:

- `tests/css-mapping.test.js` — every `icon-large` class has a sprite offset,
  and the readable and minified stylesheets define the same icons at the same
  offsets
- `tests/sprite-integrity.test.js` — the sprite is a structurally valid PNG, the
  `img/glyphicons.png` symlink resolves, and no icon offset points past the edge
  of the image (which would render a silently blank icon)
- `tests/published-package.test.js` — packaging and supply-chain invariants: no
  dependencies, no install scripts, a lockfile that matches the manifest, and no
  `url()` or `@import` in the CSS that escapes the published package or reaches
  a third party
- `tests/docker-preview.test.js` — the preview container stays non-root,
  capability-free, read-only, and serves the assets at the paths the CSS expects
- `tests/docs.test.js` — the README, `CONTRIBUTING.md`, `.env.example` and
  `docker-compose.yml` agree with each other

Style and hygiene are checked separately by the bundled linter:

```sh
npm run lint
```

It performs a syntax check on every JavaScript file and then enforces the rules
that matter here: no `eval` or shell execution, no un-prefixed `require()` calls
that a hostile `node_modules` package could shadow, no focused or unexplained
skipped tests, no trailing whitespace, and no committed credential patterns.
There is no `node_modules` to install.

Node 22 (see `.nvmrc`) can also report coverage using the built-in runner:

```sh
node --test --experimental-test-coverage
```

The same checks run in CI on every push and pull request, across Node 20, 22
and 24 (see `.github/workflows/ci.yml`). CI installs with `npm ci
--ignore-scripts` and additionally runs `npm audit --audit-level=high`.

Run with Docker
---------------

To preview the assets in an isolated environment:

```sh
docker compose up --build
```

Then open <http://localhost:8080/css/bootstrap.icon-large.min.css> (or
<http://localhost:8080/img/glyphicons.png>) to confirm the files are served
with the same relative layout the CSS expects.

The preview runs as an unprivileged user on port 8080 inside the container, with
every Linux capability dropped, a read-only root filesystem, and the host port
bound to `127.0.0.1`. It is a static file server with no authentication, so keep
it on loopback unless you deliberately want it reachable from your network.

Environment
-----------

The preview takes two optional settings. Copy `.env.example` to `.env` to
change them; the defaults below are what Compose uses when no `.env` exists.

| Variable        | Default     | Purpose                                            |
| --------------- | ----------- | -------------------------------------------------- |
| `BIND_ADDRESS`  | `127.0.0.1` | Host interface the preview binds to                |
| `PORT`          | `8080`      | Host port published for the preview                 |

No other environment variables are read, and none of them are secrets — `.env`
is git-ignored, and `npm run lint` fails if a credential-shaped value ever
appears in `.env.example`.

Security
--------

This package has no dependencies and no runtime. That is treated as a security
property rather than a packaging detail, and it is enforced by the test suite
and the linter. See [SECURITY.md](SECURITY.md) for what is checked
automatically and how to report a vulnerability privately.

License
-------

See [LICENSE.md](LICENSE.md). The CSS mapping is derived from Bootstrap and is
Apache License 2.0; the GLYPHICONS sprite is CC BY 3.0 and requires visible
attribution to [glyphicons.com](http://www.glyphicons.com/) unless a
commercial license has been purchased.

Contributing
------------

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or fix icon mappings,
including the required `npm test` and `npm run lint` steps.
