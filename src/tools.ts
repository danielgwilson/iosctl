import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { commandOutput } from "./shell.js";

export const idbPaths = [
  `${homedir()}/.local/bin/idb`,
  "/opt/homebrew/bin/idb",
  "/usr/local/bin/idb",
];

export const idbCompanionPaths = [
  "/opt/homebrew/bin/idb_companion",
  "/usr/local/bin/idb_companion",
];

export function resolveExecutable(command: string, extraPaths: string[] = []): string | null {
  const path = commandOutput("which", [command], 10_000);
  if (path) {
    return path;
  }

  for (const candidate of extraPaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveIdb(): string | null {
  return resolveExecutable("idb", idbPaths);
}

export function resolveIdbCompanion(): string | null {
  return resolveExecutable("idb_companion", idbCompanionPaths);
}

export function idbBaseArgs(): string[] {
  const companion = resolveIdbCompanion();
  return companion ? ["--companion-path", companion] : [];
}
