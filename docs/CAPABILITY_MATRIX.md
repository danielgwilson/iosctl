# Capability Matrix

| Capability | Agent scenario served | Existing skill | Existing CLI | Official tool | Third-party tool | Coverage verdict | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| environment doctor | preflight native iOS work | XcodeBuildMCP skill precedent | XcodeBuildMCP CLI precedent | `xcodebuild`, `simctl` | none required | core | Normalize into one JSON envelope. |
| device inventory | choose Simulator target | `ios-simulator-skill` precedent | `simctl` | `simctl list --json` | `idb list-targets --json` | core | Prefer first-party inventory, enrich with `idb` when present. |
| build | prove app compiles | XcodeBuildMCP skill precedent | XcodeBuildMCP CLI precedent | `xcodebuild` | `xcbeautify` optional | core | Preserve raw logs and result paths. |
| test | prove behavior with XCTest | XcodeBuildMCP skill precedent | XcodeBuildMCP CLI precedent | `xcodebuild`, `xcresulttool` | `xcbeautify` optional | phase 2 | `.xcresult` is truth. |
| install and launch | prove app starts | XcodeBuildMCP skill precedent | `simctl` | `simctl install`, `simctl launch` | `idb launch` optional | core | Redact env values in receipts. |
| screenshot and video | visual proof | XcodeBuildMCP skill precedent | `simctl` | `simctl io` | `idb` optional | core | Screenshots are proof, not primary UI state. |
| semantic UI tree | agent navigation | `ios-simulator-skill` precedent | `idb` | none outside XCUITest | `idb`, Appium/WDA, Maestro | phase 2 | Apple gap; use accessibility tree first. |
| semantic tap/type/swipe | agent interactions | `ios-simulator-skill` precedent | `idb` | none outside XCUITest | `idb`, Appium/WDA, Maestro | phase 2 | Coordinate fallback only when explicit. |
| result parsing | compact failure summaries | XcodeBuildMCP skill precedent | `xcresulttool` | `xcresulttool` | `xcparse` optional | phase 2 | Avoid raw log floods. |
| profiling evidence | performance artifacts | plugin precedent | `xctrace` | `xctrace` | ETTrace optional | later | Capture evidence first, thresholds later. |
| flow runner | durable black-box journeys | Maestro precedent | Maestro | none | Maestro | optional | Wrap after low-level spine is stable. |
| MCP transport | tool-call UX | XcodeBuildMCP precedent | n/a | Apple Xcode MCP emerging | XcodeBuildMCP | optional | Thin wrapper only, never substrate. |
