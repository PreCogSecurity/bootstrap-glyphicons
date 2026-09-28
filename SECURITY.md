# Security Policy

## Scope

`bootstrap-glyphicons` is a static asset pack: two stylesheets and one PNG
sprite. It has no server, no runtime, and **no dependencies** — not at runtime
and not in development. Nothing in this repository executes on a consumer's
machine when they copy the CSS into their site.

That property is a security control, and it is enforced by the test suite
rather than by convention. `tests/published-package.test.js` fails if anyone
adds a dependency, a lifecycle script (`preinstall`, `postinstall`, …), a
`url()` that leaves the published package, an off-site reference, or an
`@import` into either stylesheet.

## What is checked automatically

| Property | Enforced by |
| --- | --- |
| No runtime or development dependencies | `npm test` |
| No install-time lifecycle scripts | `npm test` |
| Lockfile matches the manifest (`npm ci` is reproducible) | `npm test` |
| Every `url()` stays inside the published tarball | `npm test` |
| No off-site, `data:`, or script-bearing CSS | `npm test` |
| No credential patterns committed to the repository | `npm run lint` |
| No dependency known vulnerabilities (high or critical) | CI `npm audit --audit-level=high` |
| Preview container runs non-root, read-only, with no capabilities | `npm test` |

## The preview container

`docker compose up --build` serves the pack locally. It is hardened by default:
non-root uid on an unprivileged port, all capabilities dropped,
`no-new-privileges`, read-only root filesystem, dotfiles denied, and the
published port bound to `127.0.0.1` rather than every interface. It is still an
**unauthenticated** static file server — if you change `BIND_ADDRESS` to
`0.0.0.0` you have published it to your network.

## Reporting a vulnerability

Please **report** suspected vulnerabilities privately through GitHub's
advisory flow rather than opening a public issue:

<https://github.com/PreCogSecurity/bootstrap-glyphicons/security/advisories/new>

Include the affected file, the exact input or diff that triggers the problem,
and the impact you observed. You can expect an acknowledgement within a few
business days.

Most reports for a package this size are CSS/sprite correctness bugs rather
than exploitable code. Those belong in the normal issue tracker — the split
matters only so that a genuine supply-chain or injection problem is not
disclosed in public before it is fixed.

## Supported versions

The pack has a single published line. Fixes are applied to the tip of the
default branch and released as a new patch version; there are no long-term
support branches to backport to.
