# Release Checklist

Before making this repository public or publishing npm:

- Verify docs and examples are synthetic.
- Verify no screenshots, HARs, traces, cookies, raw app logs, or `.iosctl/` artifacts are tracked.
- Run `npm run check:release`.
- Run `npm audit --omit=dev --json`.
- Run `npm pack --dry-run --json --silent` and inspect files.
- Run built `iosctl --help`.
- Run built `iosctl doctor --json` on macOS with Xcode installed.
- Run workspace-level secret sweep from the platform-adapters workspace.
- Prove `npx -y skills add -g danielgwilson/iosctl --skill iosctl` from a temporary home after the repo is public.
- Only then switch repository visibility to public.
