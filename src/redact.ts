const secretLikePatterns = [
  /AQ\.[A-Za-z0-9._-]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /sk_(?:live|test|proj)_[A-Za-z0-9]{16,}/g,
  /sk-[A-Za-z0-9_-]{32,}/g,
  /xai-[A-Za-z0-9_-]{32,}/g,
  /xox[baporsc]-[A-Za-z0-9-]{10,}/g,
  /ya29\.[A-Za-z0-9\-_]+/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactText(value: string): string {
  let redacted = value;
  for (const pattern of secretLikePatterns) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

export function redactArgs(args: string[]): string[] {
  const redacted = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index] ?? "";
    const lower = value.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("api-key") ||
      lower.includes("apikey")
    ) {
      redacted.push("[REDACTED-ARG]");
      continue;
    }
    redacted.push(redactText(value));
  }
  return redacted;
}
