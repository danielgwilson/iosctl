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
  DerivedData/
  xcodebuild.xcresult
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

## Phase 1 Proof Run

`iosctl proof-run` currently:

1. resolves a matching available iOS Simulator,
2. boots it if needed,
3. builds the provided Xcode project/workspace with `xcodebuild`,
4. installs the built app with `simctl install`,
5. launches the bundle with `simctl launch`,
6. waits for the configured settle period,
7. captures a screenshot with `simctl io screenshot`,
8. writes `receipt.json` and `summary.md`.

Env file values are passed to the app as `SIMCTL_CHILD_*` environment variables. Receipts include env keys only, never values.

## Secret Rules

- Never pass secrets as CLI arguments.
- Env files may be read for app launch.
- Receipts must redact secret values and secret-like values.
- `.iosctl/` is ignored by git.
- Raw app logs and screenshots are treated as local private artifacts.
