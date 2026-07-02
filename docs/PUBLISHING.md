# Publishing

This repository is set up for npm Trusted Publishing from GitHub Actions.

Research basis, checked 2026-07-02:

- npm Trusted Publishing docs: https://docs.npmjs.com/trusted-publishers/
- npm provenance docs: https://docs.npmjs.com/generating-provenance-statements/
- GitHub package publishing docs: https://docs.github.com/actions/tutorials/publish-packages/publish-nodejs-packages
- GitHub changelog for npm OIDC GA: https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/

## Current Best Practice

- Use npm Trusted Publishing with GitHub Actions OIDC.
- Do not store `NPM_TOKEN` in GitHub Actions for normal publishing.
- Use GitHub-hosted runners, not self-hosted runners, for npm Trusted Publishing.
- Use npm CLI `11.5.1+` and Node.js `22.14.0+` in the publish job.
- Give the publish job `id-token: write` and `contents: read`; keep other jobs narrower.
- Keep `publish.yml` as the trusted workflow filename.
- Publish from a public repository if provenance attestations are expected.
- Let Trusted Publishing generate provenance automatically; do not require `--provenance` in the trusted publish command.
- After Trusted Publishing works, restrict package publishing access on npm to require 2FA and disallow legacy tokens.

## Initial Name Claim

npm Trusted Publishing is configured from package settings. For an unclaimed package name, the package usually has to exist before those settings are available.

Initial claim sequence:

1. Run all release checks locally.
2. Make the GitHub repository public.
3. Confirm `npm view iosctl --json` still returns 404.
4. Publish the initial version from a logged-in maintainer machine:

   ```bash
   npm publish --access public
   ```

5. Configure npm Trusted Publishing for future releases:

   ```text
   Publisher: GitHub Actions
   Organization/user: danielgwilson
   Repository: iosctl
   Workflow filename: publish.yml
   Environment name: blank
   Allowed actions: npm publish
   ```

6. Restrict npm package publishing access:

   ```text
   Require two-factor authentication and disallow tokens
   ```

7. Publish future versions by tagging `main`:

   ```bash
   npm version patch -m "Release %s"
   git push origin main --tags
   ```

## Local Release Gate

Run before making the repo public or publishing:

```bash
npm run check:release
npm audit --omit=dev --audit-level=moderate
npm pack --dry-run --json --silent
node dist/cli.js --help
node dist/cli.js doctor --json
```

From the platform-adapters workspace:

```bash
./scripts/secret-sweep.sh
```

After the repository is public, prove the skill install path from a temporary home:

```bash
HOME="$(mktemp -d)" npx -y skills add -g danielgwilson/iosctl --skill iosctl
```

## Verification After Publish

```bash
npm view iosctl version dist-tags.latest repository.url --json
npx -y iosctl@latest --version
npx -y iosctl@latest doctor --json
gh run list --workflow Publish --limit 5
```
