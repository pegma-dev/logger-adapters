# Release operations

Logger Adapters publishes only from a stable GitHub release. Merging a pull
request never publishes, and the workflow has no manual-dispatch or npm-token
fallback.

## Required external configuration

Before the first release through this workflow:

- configure each public package on npm with the GitHub Actions trusted
  publisher `pegma-dev/logger-adapters`, workflow `publish.yml`, environment
  `npm-publish`, and allowed action `npm publish`;
- create the GitHub `npm-publish` environment. A second reviewer is not
  required under Pegma's single-maintainer policy;
- create the Actions variable `RELEASE_ALLOWED_SIGNERS` containing the
  reviewed Git SSH allowed-signers entry for the maintainer's release key; and
- create an active tag ruleset targeting `v*` that prevents tag updates and
  deletions and limits tag creation to the release maintainer.

Do not add `NODE_AUTH_TOKEN`, an npm automation token, or another credential
fallback. After one trusted-publisher release is verified, disable any
remaining traditional npm publish tokens.

## Independent package versions

The repository has independent package versions. A `vX.Y.Z` release publishes
only public workspaces whose manifest version is `X.Y.Z`. Every other
workspace is packed too and must reproduce the exact integrity already on npm;
this prevents an unversioned package change from hiding in another package's
release.

Release version numbers are nevertheless allocated repository-wide because
Git tags share one namespace. Before changing a package version, choose a
stable `X.Y.Z` that has never appeared as a `vX.Y.Z` tag in this repository;
normally use the next version after the highest existing release tag. A
package may therefore skip numeric versions. Packages intentionally released
together may share the same version and tag, but a later package must never
reuse an earlier release's number or move its tag.

The reviewed release order is:

1. `@pegma/logger-tee`
2. `@pegma/logger-applicationinsights`
3. `@pegma/logger-cloudflare`
4. `@pegma/logger-datadog`

All four packages depend only on the already-published Spine contract. The
explicit order remains stable across retries, and the release script requires
any future internal dependencies to be exact workspace-version pins.

## Release procedure

Change package versions through an ordinary reviewed pull request that updates
`pnpm-lock.yaml` with the rest of the manifests, then run the complete gate
on Node 22 and 24:

```sh
corepack enable
pnpm install
pnpm run format:check
pnpm run check
pnpm test
```

After merge, create a signed annotated tag at the exact `origin/main` commit,
push and verify that tag, and only then create the GitHub release with
`--verify-tag`. Never let GitHub create, move, or replace the tag.

Tags published before the pnpm conversion used `package-lock.json` and
`npm ci`. Those tags are immutable; do not rewrite their documented npm
commands onto pnpm.

The unprivileged preparation job verifies the tag signature, version,
release-event commit, and `origin/main` ancestry; enables Corepack for the
`packageManager` pin; installs the reviewed npm version with caching disabled
so `npm pack` and trusted publishing stay on known bytes; runs the full gate
with pnpm; packs every public workspace exactly once; smoke-tests the
tarballs; and records each tarball's SHA-1 and SHA-512 integrity.

Only the `npm-publish` job receives `id-token: write`. It installs no
dependencies, verifies the downloaded prepared artifact, and publishes
release candidates in the dependency-first order above with npm provenance.

## Partial-publish recovery

The workflow is globally serialized. Re-run failed release jobs against the
same unchanged tag:

- an absent version is published;
- an existing version with identical `dist.integrity` is verified and skipped;
- a different integrity, or any registry error other than `E404`, stops before
  later packages publish.

After each publish, the workflow waits for npm to expose the expected
integrity before advancing. Never unpublish and reuse a version.
