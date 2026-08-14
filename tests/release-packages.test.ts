import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RELEASE_PACKAGES,
  REVIEWED_NPM_VERSION,
  REVIEWED_PNPM_PACKAGE_MANAGER,
  decidePublication,
  parseArguments,
  parsePnpmLockfileImporters,
  validateReleaseTag,
  validateRepository,
} from "../scripts/release-packages.mjs";

const git = process.platform === "win32" ? "git.exe" : "git";
const releaseVersion = (
  JSON.parse(
    readFileSync(
      join(process.cwd(), "packages", "logger-tee", "package.json"),
      "utf8",
    ),
  ) as { version: string }
).version;

function run(command: string, arguments_: string[], cwd?: string): string {
  return execFileSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function publishWorkflowJobs(): {
  header: string;
  prepare: string;
  publish: string;
  workflow: string;
} {
  const workflow = readFileSync(
    join(process.cwd(), ".github", "workflows", "publish.yml"),
    "utf8",
  );
  const jobsMarker = "\njobs:\n";
  const jobsIndex = workflow.indexOf(jobsMarker);
  expect(jobsIndex).toBeGreaterThanOrEqual(0);
  const header = workflow.slice(0, jobsIndex);
  const jobs = workflow.slice(jobsIndex + jobsMarker.length);
  const prepareStart = jobs.indexOf("  prepare:");
  const publishStart = jobs.indexOf("\n  publish:");
  expect(prepareStart).toBeGreaterThanOrEqual(0);
  expect(publishStart).toBeGreaterThan(prepareStart);
  return {
    header,
    prepare: jobs.slice(prepareStart, publishStart),
    publish: jobs.slice(publishStart),
    workflow,
  };
}

describe("release package metadata", () => {
  it("accepts npm's cross-platform argument separator", () => {
    expect(parseArguments(["--", "--output", ".release"])).toEqual({
      output: ".release",
    });
  });

  it("keeps the exact public package inventory", () => {
    expect(RELEASE_PACKAGES.map(({ name }) => name)).toEqual([
      "@pegma/logger-tee",
      "@pegma/logger-applicationinsights",
      "@pegma/logger-cloudflare",
      "@pegma/logger-datadog",
    ]);
  });

  it("validates package manifests and the lockfile together", async () => {
    await expect(validateRepository()).resolves.toBeDefined();
  });

  it("pins the reviewed pnpm release with a Corepack integrity hash", () => {
    const { packageManager } = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { packageManager: string };
    expect(packageManager).toBe(REVIEWED_PNPM_PACKAGE_MANAGER);
    expect(packageManager).toMatch(/^pnpm@10\.34\.5\+sha512\.[0-9a-f]{128}$/u);
  });

  it("keeps both the lockfile specifier and the resolved version", () => {
    const lockfile = parsePnpmLockfileImporters(
      [
        "lockfileVersion: '9.0'",
        "",
        "importers:",
        "",
        "  packages/logger-tee:",
        "    dependencies:",
        "      '@pegma/spine':",
        "        specifier: 0.1.1",
        "        version: 999.0.0",
        "",
        "packages:",
        "",
      ].join("\n"),
    );
    expect(
      lockfile["packages/logger-tee"]?.dependencies?.["@pegma/spine"],
    ).toEqual({
      specifier: "0.1.1",
      version: "999.0.0",
    });
  });

  it("invokes a real npm CLI rather than npm_execpath", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "release-packages.mjs"),
      "utf8",
    );
    expect(source).toMatch(/function runNpm\(/u);
    expect(source).not.toMatch(/process\.env\.npm_execpath/u);
  });

  it("requires the release tag to match a public package version", async () => {
    await expect(validateRepository({ releaseTag: "v9.9.9" })).rejects.toThrow(
      "does not match any public package version",
    );
    await expect(
      validateRepository({
        releaseTag: `v${releaseVersion}`,
        releasePrerelease: true,
      }),
    ).rejects.toThrow("prereleases cannot publish packages");
  });
});

describe("release source authentication", () => {
  it("accepts only an approved signed annotated tag at the event commit", () => {
    const root = mkdtempSync(join(tmpdir(), "logger-release-tag-"));
    try {
      run(git, ["init", "--quiet"], root);
      run(git, ["config", "user.name", "Release Test"], root);
      run(git, ["config", "user.email", "release@example.com"], root);
      writeFileSync(join(root, "README.md"), "release test\n");
      run(git, ["add", "README.md"], root);
      run(git, ["commit", "--quiet", "-m", "release"], root);
      run(git, ["branch", "-M", "main"], root);
      run(git, ["update-ref", "refs/remotes/origin/main", "HEAD"], root);
      const releaseCommit = run(git, ["rev-parse", "HEAD"], root);

      const signingKey = join(root, "release-signing-key");
      run("ssh-keygen", [
        "-q",
        "-t",
        "ed25519",
        "-N",
        "",
        "-C",
        "release@example.com",
        "-f",
        signingKey,
      ]);
      const allowedSigners = join(root, "allowed-signers");
      writeFileSync(
        allowedSigners,
        `release@example.com ${readFileSync(`${signingKey}.pub`, "utf8").trim()}\n`,
      );
      run(git, ["config", "gpg.format", "ssh"], root);
      run(git, ["config", "user.signingkey", signingKey], root);
      run(git, ["config", "gpg.ssh.allowedSignersFile", allowedSigners], root);

      run(git, ["tag", "--sign", "v0.0.0", "--message", "signed"], root);
      expect(
        validateReleaseTag({
          root,
          releaseTag: "v0.0.0",
          expectedReleaseCommit: releaseCommit,
        }),
      ).toEqual({ headCommit: releaseCommit, releaseTag: "v0.0.0" });

      run(git, ["tag", "v0.0.1"], root);
      expect(() =>
        validateReleaseTag({
          root,
          releaseTag: "v0.0.1",
          expectedReleaseCommit: releaseCommit,
        }),
      ).toThrow("annotated tag object");

      run(
        git,
        [
          "-c",
          "commit.gpgsign=false",
          "tag",
          "--annotate",
          "v0.0.2",
          "--message",
          "unsigned",
        ],
        root,
      );
      expect(() =>
        validateReleaseTag({
          root,
          releaseTag: "v0.0.2",
          expectedReleaseCommit: releaseCommit,
        }),
      ).toThrow("not valid for an approved signer");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps preparation outside the OIDC-enabled publisher job", () => {
    const { header, prepare, publish, workflow } = publishWorkflowJobs();
    expect(header).not.toContain("id-token: write");
    expect(prepare).not.toContain("id-token: write");
    expect(publish).toContain("id-token: write");
    expect(prepare).toContain("pnpm install --frozen-lockfile");
    expect(prepare).not.toContain("npm ci");
    expect(publish).not.toContain("npm ci");
    expect(publish).not.toContain("npm install");
    expect(publish).not.toContain("pnpm install");
    expect(publish).not.toContain("corepack");
    expect(publish).toContain("npm run release:publish");
    expect(workflow).not.toContain("workflow_dispatch");
    expect(workflow).toContain("retention-days: 30");
  });

  it("verifies the prepared manifest against a pinned prepare-job output", () => {
    const { prepare, publish } = publishWorkflowJobs();
    expect(prepare).toContain(
      "manifest-digest: ${{ steps.manifest-digest.outputs.manifest-digest }}",
    );
    expect(prepare).toContain(
      'sha256sum .release/package-manifest.json | cut -d " " -f 1',
    );
    const verification = publish.indexOf(
      "EXPECTED_MANIFEST_DIGEST: ${{ needs.prepare.outputs.manifest-digest }}",
    );
    expect(verification).toBeGreaterThanOrEqual(0);
    expect(publish).toContain("sha256sum --check --strict --quiet");
    expect(verification).toBeLessThan(
      publish.indexOf("npm run release:publish"),
    );
  });

  it("installs the reviewed npm release from a digest-pinned tarball", () => {
    const { prepare } = publishWorkflowJobs();
    expect(prepare).toContain(`NPM_VERSION: ${REVIEWED_NPM_VERSION}`);
    expect(prepare).toContain(
      "NPM_INTEGRITY: sha512-T67M4L5wNm0cZ7EBLErcEkY1SmzEW/WJ+SADBzsFUY1UdAPfFHXFQtZ6SEXiK0+vzXysCvAsepbMaBTwnrAD+w==",
    );
    expect(prepare).toContain('npm install --global "${tarball}"');
    expect(prepare).not.toContain(
      `npm install --global npm@${REVIEWED_NPM_VERSION}`,
    );
  });
});

describe("retry-safe publication", () => {
  const integrity = "sha512-cHJlcGFyZWQtdGFyYmFsbA==";

  it("publishes an absent version", () => {
    expect(decidePublication(integrity, null)).toBe("publish");
  });

  it("skips a byte-identical existing version", () => {
    expect(decidePublication(integrity, integrity)).toBe("skip");
  });

  it("rejects an existing version with different bytes", () => {
    expect(() => decidePublication(integrity, "sha512-ZGlmZmVyZW50")).toThrow(
      "different tarball integrity",
    );
  });
});
