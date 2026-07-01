# Contract V1

## Command Contract

With `--json`, stdout contains exactly one JSON object.

Progress, warnings, child command echoes, and diagnostics go to stderr.

Exit codes:

- `0`: success.
- `1`: operation failed.
- `2`: invalid input, missing local capability, or user action required.
- `3`: safety refusal.

## Success Envelope

```json
{
  "ok": true,
  "data": {
    "command": "doctor"
  }
}
```

## Failure Envelope

```json
{
  "ok": false,
  "error": {
    "code": "MISSING_TOOL",
    "message": "Required tool is not available on PATH.",
    "retryable": false
  }
}
```

## Core Error Codes

- `MISSING_TOOL`
- `COMMAND_FAILED`
- `INVALID_INPUT`
- `SAFETY_REFUSAL`
- `NOT_IMPLEMENTED`
- `XCODE_UNAVAILABLE`
- `SIMULATOR_UNAVAILABLE`
- `DESTINATION_UNAVAILABLE`
- `APP_NOT_FOUND`
- `BUNDLE_LAUNCH_FAILED`
- `UI_TREE_UNAVAILABLE`
- `TIMEOUT`

## Artifact Contract

Proof-producing commands write to:

```text
.iosctl/runs/<run-id>/
  receipt.json
  summary.md
  build.log
  app.log
  screenshot-*.png
  ui-tree.json
```

Run receipts must include:

- `runId`
- command name
- redacted argv
- active Xcode path/version
- selected Simulator UDID/name/runtime
- project/workspace/scheme/configuration
- bundle ID
- app path
- screenshot paths
- UI tree artifact path when captured
- log paths
- elapsed timings
- normalized warnings/errors

## Secret Rules

- Never pass secrets as CLI arguments.
- Env files may be read for app launch.
- Receipts must redact secret values and secret-like values.
- `.iosctl/` is ignored by git.
- Raw app logs and screenshots are treated as local private artifacts.
