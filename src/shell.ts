import { spawnSync } from "node:child_process";
import { redactText } from "./redact.js";

export type CommandResult = {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export function runCommand(command: string, args: string[], timeoutMs = 30_000): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    command,
    args,
    exitCode: result.status,
    stdout: redactText(result.stdout ?? ""),
    stderr: redactText(result.stderr ?? ""),
    error: result.error?.message,
  };
}

export function commandOk(command: string, args: string[], timeoutMs = 10_000): boolean {
  const result = runCommand(command, args, timeoutMs);
  return result.exitCode === 0;
}

export function commandOutput(command: string, args: string[], timeoutMs = 10_000): string | null {
  const result = runCommand(command, args, timeoutMs);
  if (result.exitCode !== 0) {
    return null;
  }
  return result.stdout.trim();
}
