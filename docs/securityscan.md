# Security Scan Report

**Repository:** logger-adapters
**Scan date:** 2026-07-28
**Scope:** Repository-wide security review (dependencies, source code, workflows, configuration)

## Status

Scan complete.

## Areas reviewed and found clear

- **Published adapter source** (`packages/*/src/index.ts`): No `eval`, `new
  Function`, `child_process`, filesystem, network, or `process.env` access.
  Every `log` implementation wraps sink calls in `try/catch` and swallows
  transport errors — the deliberate posture documented in `AGENTS.md` ("sink
  failures must not take down the request"). No user input reaches a shell,
  SQL, HTML, or a deserializer other than `JSON.stringify`.
- **Prototype pollution:** `toProperties`/`toAttributes` assign
  attacker-controlled keys via bracket notation, but assigned values are
  always strings or primitives (`JSON.stringify` output), so a `__proto__`
  key assignment is a no-op under the `__proto__` setter semantics. No
  pollution path.
- **Secrets:** Regex sweep for API keys, tokens, private keys, connection
  strings, Datadog `DD_API_KEY`, and App Insights `InstrumentationKey`
  patterns across source, docs, tests, and config found nothing. `.env*`
  files are gitignored. The only keys in tests are ephemeral SSH keys
  generated in `tmpdir` and deleted.
- **CI/CD workflows:** All third-party actions are pinned to full commit
  SHAs. Workflow permissions are minimal (`contents: read`); `id-token:
  write` exists only in the protected `npm-publish` environment job — a
  property enforced by a test (`tests/release-packages.test.ts:143`). No
  `pull_request_target`, no `workflow_dispatch` publish path, no token
  fallback. Event data used in `run:` steps flows through environment
  variables (quoted), not inline `${{ }}` interpolation; the tag name used
  in `checkout` `with:` is constrained to `^v\d+\.\d+\.\d+$` before any git
  invocation.
- **Release script** (`scripts/release-packages.mjs`): Requires a signed
  annotated tag from an approved signer (`gpg.ssh.allowedSignersFile`),
  verifies checkout/tag/event commit agreement with `timingSafeEqual`,
  checks the tag commit is an ancestor of `origin/main`, hashes tarballs
  with SHA-512 (`hashTarball`), smoke-tests installs with
  `--ignore-scripts`, refuses to overwrite a registry version with different
  bytes, and restricts `publish` to the GitHub release event. All git/npm
  invocations use `spawnSync` with argument arrays (`shell: false` except
  the Windows `npm.cmd` shim, which receives no untrusted arguments).
- **Dependencies:** `npm audit` — 0 vulnerabilities. Lockfile v3; every
  registry-resolved entry has an `integrity` hash (the 4 entries without
  one are local workspace symlinks, which is expected). Runtime dependency
  surface is one exact-pinned package (`@pegma/spine@0.1.1`); the remaining
  four are devDependencies installed via `npm ci`.
- **Build integrity:** `dist/` output for all four packages matches a fresh
  `tsc` build of the reviewed source (regenerated during this scan's gate
  run). Package tarballs are allowlisted to `dist/`, `package.json`,
  `README.md`, `LICENSE`.
- **Project gate:** `npm run format:check`, `npm run check`, and `npm test`
  (26 tests, 5 files) all pass.

## Findings

### 1. Low — Publish pipeline: artifact digest is not verified across jobs

- **Evidence:** `.github/workflows/publish.yml` lines 74–86 record the prepared
  artifact SHA-256 digest only in the prepare job's step summary. The `publish`
  job (lines 113–120) downloads the artifact by name and validates tarball
  hashes against `package-manifest.json`, which ships **inside the same
  artifact** — the check is self-referential and cannot detect artifact
  replacement between jobs.
- **Exploitability:** Requires write access to the Actions run itself (i.e. an
  already-compromised repository or runner). GitHub artifacts are immutable
  within a run, the manifest's `gitCommit`/`releaseTag` are checked against
  the release event, and the publish environment is protected. Residual risk
  is low.
- **Recommendation:** Pass `steps.upload.outputs.artifact-digest` as a job
  output from `prepare` and compare it after `download-artifact` in `publish`.

### 2. Low — Global npm install in release pipeline without integrity pinning

- **Evidence:** `.github/workflows/publish.yml` line 57:
  `npm install --global npm@11.18.0`. The version is pinned but there is no
  hash/integrity verification of the installed tool; trust rests on TLS to
  registry.npmjs.org.
- **Exploitability:** Requires npm registry or CDN compromise serving a
  poisoned `npm@11.18.0` tarball. The step runs in the `prepare` job which
  holds no OIDC token or secrets, so a poisoned tool could corrupt artifacts
  but not exfiltrate credentials.
- **Recommendation:** Acceptable as-is for most threat models; could pin via
  a lockfile or verify a known dist hash.

### 3. Informational — No dependency-update automation or audit gate in CI

- **Evidence:** No Dependabot/Renovate configuration under `.github/`; CI
  (`.github/workflows/ci.yml`) runs format/type/tests but no `npm audit`
  step. Local `npm audit` (run during this scan) reports **0
  vulnerabilities**. Lockfile v3, 109 entries, all registry-resolved entries
  carry `integrity` hashes (the 4 without integrity are local workspace
  symlinks — expected).
- **Exploitability:** Not exploitable today; risk is silent introduction of a
  vulnerable devDependency (typescript, prettier, vitest, @types/node) in the
  future. Runtime dependency surface is a single exact-pinned package
  (`@pegma/spine@0.1.1`).
- **Recommendation:** Add Dependabot (or run `npm audit --omit=dev` in CI)
  for continuous monitoring.

### 4. Informational — No vulnerability disclosure policy

- **Evidence:** No `SECURITY.md` in the repository root.
- **Exploitability:** N/A — process gap. Researchers have no documented
  channel to report vulnerabilities in the published `@pegma/*` packages.
- **Recommendation:** Add a `SECURITY.md` with a disclosure contact.

## Summary

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | Low | Artifact digest not verified across prepare/publish jobs | `.github/workflows/publish.yml:74-86, 113-120` |
| 2 | Low | Global npm install without integrity pinning | `.github/workflows/publish.yml:57` |
| 3 | Informational | No dependency-update automation or audit gate in CI | `.github/workflows/ci.yml`, `.github/` |
| 4 | Informational | No vulnerability disclosure policy | repo root (missing `SECURITY.md`) |

**No high or medium severity vulnerabilities were found.** The repository's
published attack surface is four thin adapter functions with no I/O, no
secrets, and no dangerous sinks; the release pipeline is hardened with signed
tags, trusted-publisher OIDC, and integrity verification. The two Low
findings are defense-in-depth improvements to an already well-secured
publish pipeline.

