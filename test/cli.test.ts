import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
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

test("reserved proof-run command returns JSON failure", () => {
  const result = spawnSync(process.execPath, ["dist/cli.js", "proof-run", "--json"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");

  const parsed = JSON.parse(result.stdout) as { ok: false; error: { code: string } };
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "NOT_IMPLEMENTED");
});
