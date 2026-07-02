# iosctl

Agent-first CLI and skill for native iOS Simulator build, run, and proof loops.

`iosctl` is intentionally boring: it wraps first-party Apple command-line tools and a small number of proven adjacent tools behind stable JSON, explicit artifacts, and predictable failures.

Current status: Phase 1 proof spine. The CLI includes environment checks, Simulator inventory, and `proof-run` for build, install, launch, screenshot, and receipt artifacts. Semantic UI commands are planned next.

## Why

Agents need a reliable way to prove iOS app behavior without depending on long-running MCP helper servers as the source of truth.

Design stance:

- CLI is truth.
- MCP is optional transport later.
- First-party Apple tools first.
- Accessibility tree before screenshot vision.
- Receipts or it did not happen.
- No secret leakage.

## Install

When published:

```bash
npm i -g iosctl
iosctl --help
```

Local:

```bash
npm install
npm run build
npm link
iosctl doctor --json
```

## Requirements

- macOS with full Xcode installed.
- Node.js 22+.
- `xcodebuild`.
- `xcrun simctl`.
- `xcrun xcresulttool`.
- Optional but recommended: `idb` and `idb_companion`.
- Optional: `xcbeautify`, Maestro, XcodeBuildMCP.

## Commands

Implemented:

```bash
iosctl doctor --json
iosctl devices --json
iosctl proof-run --project App.xcodeproj --scheme App --bundle com.example.app --device "iPhone 17 Pro" --json
iosctl proof-run --workspace App.xcworkspace --scheme App --bundle com.example.app --runtime "iOS 26" --json
iosctl contract --json
```

Planned:

```bash
iosctl project inspect --project App.xcodeproj --json
iosctl sim ensure --device "iPhone 17 Pro" --runtime "iOS 26" --json
iosctl build --project App.xcodeproj --scheme App --device "iPhone 17 Pro" --json
iosctl install --app ./App.app --device <UDID> --json
iosctl launch --bundle com.example.app --device <UDID> --env-file .env.local --json
iosctl ui snapshot --device <UDID> --json
iosctl ui tap --text "Book appointment" --json
```

`proof-run` writes artifacts under `.iosctl/runs/<run-id>/` by default:

- `receipt.json`
- `summary.md`
- `build.log`
- `app.log`
- `screenshot-<name>.png`
- `DerivedData/`
- `xcodebuild.xcresult`

## Agent Contract

- With `--json`, stdout is exactly one JSON object.
- Progress and diagnostics go to stderr.
- Exit `0`: success.
- Exit `1`: operation failed.
- Exit `2`: invalid input or missing local capability.
- Exit `3`: safety refusal.

See [docs/CONTRACT_V1.md](./docs/CONTRACT_V1.md).

## Skill

When this repository is public:

```bash
npx -y skills add -g danielgwilson/iosctl --skill iosctl
```

Canonical skill path: [skills/iosctl/SKILL.md](./skills/iosctl/SKILL.md).

## Release Notes

This package is scaffolded for npm trusted publishing from GitHub Actions.

- CI workflow: `.github/workflows/ci.yml`
- Publish workflow: `.github/workflows/publish.yml`
- Public-surface lint: `npm run lint:public-surface`
