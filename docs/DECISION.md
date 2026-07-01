# Decision

## Chosen Branch

- Branch: create a new official-tool-first CLI plus nested agent skill.

## Why This Branch

The important substrate already exists in first-party Apple tools. The missing piece is an agent-first contract: small JSON outputs, predictable errors, explicit proof directories, and recipes that keep agents away from brittle MCP-only state.

`iosctl` should wrap:

- `xcodebuild` for build/test.
- `xcrun simctl` for Simulator and app lifecycle.
- `xcrun xcresulttool` for result parsing.
- `xcrun xctrace` for optional profiling evidence.
- `idb` for semantic UI inspection and interactions.

## Why Other Branches Were Rejected

- Existing tool only: XcodeBuildMCP and `ios-simulator-skill` are strong precedents, but neither is the exact stable public contract wanted here.
- Skill only: a skill without a CLI still leaves agents hand-rolling shell commands and log parsing.
- Official-API-first CLI: there is no single iOS development API. The official surface is a set of local command-line tools.
- Private-surface adapter: not needed. This is local developer tooling, not a private web API.
- Hybrid: useful later, but v1 should be a narrow CLI with optional adapters.

## Required Deliverables

- TypeScript CLI package.
- `docs/CONTRACT_V1.md`.
- `docs/CAPABILITY_MATRIX.md`.
- `docs/SCENARIOS.md`.
- `skills/iosctl/SKILL.md`.
- Public-surface lint.
- CI and trusted-publishing skeleton.

## Release and Skill Proof

- Publication target: private GitHub first, public GitHub and npm later.
- Skill install shape: `skills/iosctl/SKILL.md`.
- Release/publication proof required before ship:
  - `npm run check:release`
  - `npm audit --omit=dev --json`
  - `npm pack --dry-run --json --silent`
  - built `iosctl --help`
  - built `iosctl doctor --json`
  - temporary-home skill install proof after the repo is public
- Workspace-level secret sweep required before public visibility.
- Fresh-agent scenario validation required before public release.

## Risks and Guardrails

- `idb_companion` can become helper-state drag. `doctor` must surface stale helper state and remediation.
- Xcode destination resolution is noisy. Commands must preserve `showdestinations` evidence.
- UI trees can be huge or empty. Store full trees as artifacts and return capped summaries.
- Simulator state can rot. Support disposable Simulator config and explicit erase gates.
- Runtime artifacts can contain sensitive screenshots/logs. `.iosctl/` is ignored by git and excluded from package output.

## Next Implementation Step

Complete the Phase 1 proof spine: build, install, launch, screenshot, receipt, and proof-run.
