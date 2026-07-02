import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseEnvFile, selectSimulator } from "../src/proofRun.js";
import { redactArgs, redactText } from "../src/redact.js";

test("redacts common secret-like values", () => {
  const fakeSecret = `sk-${"12345678901234567890123456789012"}`;
  assert.equal(redactText(`token ${fakeSecret}`), "token [REDACTED]");
  assert.deepEqual(redactArgs(["--api-key", fakeSecret]), [
    "[REDACTED-ARG]",
    "[REDACTED]",
  ]);
});

test("built CLI help works", () => {
  const output = execFileSync(process.execPath, ["dist/cli.js", "--help"], {
    encoding: "utf8",
  });
  assert.match(output, /iosctl/);
  assert.match(output, /doctor/);
});

test("proof-run validation returns JSON failure and receipt artifact", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "iosctl-test-"));
  const result = spawnSync(process.execPath, [
    "dist/cli.js",
    "proof-run",
    "--scheme",
    "ExampleApp",
    "--bundle",
    "com.example.app",
    "--out-dir",
    tempDir,
    "--json",
  ], {
    encoding: "utf8",
  });

  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");

  const parsed = JSON.parse(result.stdout) as { ok: false; error: { code: string; artifact: string } };
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "INVALID_INPUT");
  assert.match(parsed.error.artifact, /receipt\.json$/);
  rmSync(tempDir, { recursive: true, force: true });
});

test("parseEnvFile reads keys without exposing values", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "iosctl-env-"));
  const envPath = join(tempDir, ".env.local");
  writeFileSync(envPath, "OPENAI_MODEL=gpt-test\nexport FEATURE_FLAG='on'\n# ignored\n");

  const parsed = parseEnvFile(envPath);
  assert.deepEqual(parsed.keys, ["FEATURE_FLAG", "OPENAI_MODEL"]);
  assert.equal(parsed.env.OPENAI_MODEL, "gpt-test");
  assert.equal(parsed.env.FEATURE_FLAG, "on");

  rmSync(tempDir, { recursive: true, force: true });
});

test("selectSimulator picks requested device on newest matching runtime", () => {
  const selected = selectSimulator(
    {
      runtimes: [
        {
          identifier: "com.apple.CoreSimulator.SimRuntime.iOS-26-0",
          name: "iOS 26.0",
          version: "26.0",
          isAvailable: true,
        },
        {
          identifier: "com.apple.CoreSimulator.SimRuntime.iOS-26-6",
          name: "iOS 26.6",
          version: "26.6",
          isAvailable: true,
        },
      ],
      devices: {
        "com.apple.CoreSimulator.SimRuntime.iOS-26-0": [
          { name: "iPhone 17 Pro", udid: "old", state: "Shutdown", isAvailable: true },
        ],
        "com.apple.CoreSimulator.SimRuntime.iOS-26-6": [
          { name: "iPhone 17 Pro", udid: "new", state: "Booted", isAvailable: true },
        ],
      },
    },
    "iPhone 17 Pro",
    "iOS 26",
  );

  assert.equal(selected?.udid, "new");
});
