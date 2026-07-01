---
name: iosctl
description: Use this skill when building, launching, testing, inspecting, or proving native iOS Simulator apps with the agent-first `iosctl` CLI. Triggers include iOS Simulator proof runs, Xcode build/test loops, screenshot receipts, semantic UI tapping, accessibility-tree inspection, and replacing brittle MCP-only iOS workflows with CLI-first workflows.
---

# iosctl

Use `iosctl` for native iOS Simulator build/run/proof loops.

Default stance:

- Prefer the `iosctl` CLI over MCP-only iOS helper servers.
- Prefer `--json` for agent work.
- Treat MCP as optional transport, not source of truth.
- Prefer first-party Apple tools through `iosctl` before third-party abstractions.
- Prefer accessibility trees and identifiers before screenshot vision.
- Do not claim the app works unless there is a receipt, screenshot path, or result artifact.
- Do not pass secrets as command-line arguments.

## Sanity Checks

Start with:

```bash
iosctl doctor --json
iosctl devices --json
```

If `iosctl` is missing from `PATH`, install the published CLI when available:

```bash
npm i -g iosctl
```

For local development, use the repository checkout:

```bash
npm install
npm run build
npm link
```

## Proof Loop

The intended proof-run shape is:

```bash
iosctl proof-run \
  --project App.xcodeproj \
  --scheme App \
  --bundle com.example.app \
  --device "iPhone 17 Pro" \
  --json
```

Expected artifacts:

- `.iosctl/runs/<run-id>/receipt.json`
- `.iosctl/runs/<run-id>/summary.md`
- build log or result path
- app log path
- screenshot path
- optional UI tree path

If proof-run is not implemented or fails, fall back manually in this order:

1. `iosctl doctor --json`
2. `iosctl devices --json`
3. direct `xcodebuild` build with explicit DerivedData and result paths
4. direct `xcrun simctl boot/install/launch`
5. direct `xcrun simctl io ... screenshot`
6. store commands and artifacts in a run directory

## Semantic UI

When available, use the planned semantic UI commands:

```bash
iosctl ui snapshot --device <UDID> --json
iosctl ui tap --text "Book appointment" --json
iosctl ui type --text-field "Ask anything..." --value "Can you help with scheduling?" --json
```

If unavailable, use `idb ui describe-all` directly before screenshot vision.

## Contract Essentials

- With `--json`, stdout must be exactly one JSON object.
- Progress belongs on stderr.
- Exit codes:
  - `0` success
  - `1` operation failed
  - `2` invalid input, missing capability, or user action required
  - `3` safety refusal
- Common error codes:
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

## Safety

- Never commit `.iosctl/` run artifacts unless explicitly sanitized.
- Never paste full app logs, screenshots, or UI trees into public docs without review.
- Never pass API keys or auth tokens as CLI arguments.
- Treat screenshots and app logs as local private artifacts by default.
- Use synthetic examples in docs and tests.
