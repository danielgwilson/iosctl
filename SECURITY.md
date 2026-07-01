# Security

`iosctl` is designed for local iOS development workflows. Runtime outputs can include app logs, screenshots, UI trees, bundle identifiers, simulator metadata, and project structure.

## Reporting

Open a private security advisory or contact the maintainer directly for security-sensitive issues.

## Secret Handling

- Do not pass secrets as command-line arguments.
- Prefer env files or process environment for app launch secrets.
- `iosctl` must redact secret-like values before writing receipts, logs, summaries, or JSON output.
- Generated `.iosctl/` run directories are local artifacts and are ignored by git.
