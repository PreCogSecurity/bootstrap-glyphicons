# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Machine-readable project classification in `.repo-meta.json` so asset and
  infrastructure scanners do not mistake the pack for an IaC project.
- CI hardening: GitHub Actions pinned to immutable commit SHAs, per-job
  timeouts, `npm ci --ignore-scripts` in every job, and a published
  `sbom.json` dependency-inventory artifact.
- Preview-server hardening: requests other than GET/HEAD are rejected, request
  bodies and headers are bounded, timeouts are explicit, and CSS responses are
  compressed.
- Linter checks for unresolved relative imports, leftover `debugger`
  statements, and workflow actions that are not pinned to a commit SHA.
- `tests/hardening.test.js` covers every invariant above.

### Changed

- `npm run verify` runs the linter and the test suite as one aggregate check.
- `.gitignore` and `.dockerignore` keep generated SBOM output and process
  artifacts out of the repository and the container image.

### Fixed

- Ship `img/glyphicons.png` as a real file instead of a symlink. npm omits
  symlinks from the published tarball, so the stylesheet's
  `url(../img/glyphicons.png)` previously resolved to a missing sprite for
  consumers who installed the package from npm.

## [1.0.0] - 2026-09-28

### Added

- The 400+ GLYPHICONS icon mapping in `bootstrap.icon-large.css` and its
  minified build.
- Zero-dependency `node:test` verification suite covering CSS/sprite mapping,
  packaging and supply-chain invariants, the container preview, and
  documentation consistency.
- Zero-dependency linter and a hardened, non-root Docker preview.

[Unreleased]: https://github.com/PreCogSecurity/bootstrap-glyphicons/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/PreCogSecurity/bootstrap-glyphicons/releases/tag/v1.0.0
