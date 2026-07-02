import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseEnvFile, selectSimulator } from "../src/proofRun.js";
import { redactArgs, redactText } from "../src/redact.js";
import { findElements, flattenAccessibilityTree, normalizeFrame } from "../src/ui.js";

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

test("built doctor emits one JSON envelope", () => {
  const result = spawnSync(process.execPath, ["dist/cli.js", "doctor", "--json"], {
    encoding: "utf8",
  });

  assert.equal(result.stderr, "");
  assert.ok(result.status === 0 || result.status === 1 || result.status === 2);

  const parsed = JSON.parse(result.stdout) as { ok: boolean; data?: { command?: string }; error?: { code?: string } };
  if (parsed.ok) {
    assert.equal(parsed.data?.command, "doctor");
  } else {
    assert.ok(parsed.error?.code);
  }
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

test("flattenAccessibilityTree creates compact refs and centers", () => {
  const elements = flattenAccessibilityTree([
    {
      type: "Application",
      frame: { x: 0, y: 0, width: 400, height: 800 },
      children: [
        {
          AXLabel: "Book appointment",
          AXUniqueId: "book-appointment",
          type: "Button",
          role: "AXButton",
          enabled: true,
          frame: { x: 20, y: 700, width: 200, height: 60 },
        },
      ],
    },
  ]);

  assert.equal(elements.length, 2);
  assert.equal(elements[1]?.ref, "e2");
  assert.equal(elements[1]?.center?.x, 120);
  assert.equal(elements[1]?.center?.y, 730);
});

test("findElements matches text, identifier, role, and ref", () => {
  const elements = flattenAccessibilityTree([
    {
      type: "Application",
      frame: { x: 0, y: 0, width: 400, height: 800 },
      children: [
        {
          AXLabel: "Book appointment",
          AXUniqueId: "book-appointment",
          type: "Button",
          role: "AXButton",
          frame: { x: 20, y: 700, width: 200, height: 60 },
        },
        {
          AXLabel: "Learn more",
          type: "Button",
          role: "AXButton",
          frame: { x: 260, y: 710, width: 100, height: 30 },
        },
      ],
    },
  ]);

  assert.equal(findElements(elements, { text: "book" }).length, 1);
  assert.equal(findElements(elements, { identifier: "book-appointment", exact: true }).length, 1);
  assert.equal(findElements(elements, { role: "button" }).length, 2);
  assert.equal(findElements(elements, { ref: "e3" })[0]?.label, "Learn more");
});

test("normalizeFrame rejects invalid frames", () => {
  assert.deepEqual(normalizeFrame({ x: 1, y: 2, width: 3, height: 4 }), {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
  });
  assert.equal(normalizeFrame({ x: "nope", y: 2, width: 3, height: 4 }), undefined);
});
