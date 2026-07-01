# Scenarios

## Primary Agent Scenarios

1. Prove a local iOS app builds, installs, launches, and renders a named first screen in Simulator.
2. Capture durable proof artifacts: receipt JSON, screenshots, app logs, Simulator metadata, and result bundles.
3. Navigate a Simulator app semantically by accessibility labels or identifiers instead of relying on screenshots alone.
4. Summarize Xcode build/test failures without flooding the agent context with raw logs.
5. Run a safe local doctor check before an agent begins native iOS work.

## Risk Profile

- Read-only: high for inspection, result parsing, devices, doctor.
- Export-heavy: medium for screenshots, logs, result bundles, galleries.
- Search-heavy: low.
- Admin-heavy: low.
- Mutation-heavy: medium, limited to local Simulator/app lifecycle.

## Requirements

Must have:

- Stable JSON envelope.
- Progress on stderr.
- Explicit run artifacts.
- No secrets in argv, receipts, docs, fixtures, screenshots, or package output.
- Destructive Simulator actions gated by `--yes` or disposable config.
- Works without MCP.

Nice to have:

- Optional XcodeBuildMCP parity adapter.
- Optional Maestro flow runner.
- Optional Appium/WebDriverAgent bridge.
- Optional physical-device support through first-party tools.
- Lightweight HTML proof gallery.

Explicitly out of scope for v1:

- Android.
- Full WebDriver clone.
- App Store deployment.
- Real-device signing and provisioning workflows.
- Perfect visual diffing.

## Publication Posture

- Current: private repository.
- Target: public open source after release checks pass.
- Public readiness requires clean history, synthetic docs/examples, package-surface lint, secret sweep, npm dry run, and fresh local proof.
