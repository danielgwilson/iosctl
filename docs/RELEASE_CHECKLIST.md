# Release Checklist

Before making this repository public or publishing npm:

- Verify docs and examples are synthetic.
- Verify no screenshots, HARs, traces, cookies, raw app logs, or `.iosctl/` artifacts are tracked.
- Confirm `npm view iosctl --json` still returns 404 before the first publish.
- Run `npm run check:release`.
- Run `npm audit --omit=dev --audit-level=moderate`.
- Run `npm pack --dry-run --json --silent` and inspect files.
- Run built `iosctl --help`.
- Run built `iosctl doctor --json` on macOS with Xcode installed.
- Run workspace-level secret sweep from the platform-adapters workspace.
- Prove `npx -y skills add -g danielgwilson/iosctl --skill iosctl` from a temporary home after the repo is public.
- Switch repository visibility to public after the local release gates pass.
- For the initial name claim, publish from a logged-in maintainer machine with `npm publish --access public`.
- Configure npm Trusted Publishing after the package exists:
  - Organization/user: `danielgwilson`
  - Repository: `iosctl`
  - Workflow filename: `publish.yml`
  - Environment name: blank
  - Allowed actions: `npm publish`
- After Trusted Publishing is verified, set npm publishing access to require 2FA and disallow tokens.

See [PUBLISHING.md](./PUBLISHING.md) for the full release runbook.
