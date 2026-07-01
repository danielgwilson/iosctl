import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { commandOk, commandOutput, runCommand } from "./shell.js";

export type CheckStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  name: string;
  status: CheckStatus;
  required: boolean;
  detail?: string;
};

export type DoctorReport = {
  command: "doctor";
  platform: NodeJS.Platform;
  checks: DoctorCheck[];
  tools: Record<string, string | null>;
  summary: {
    requiredFailed: number;
    warnings: number;
  };
};

function version(command: string, args: string[]): string | null {
  return commandOutput(command, args, 10_000);
}

function versionFromPath(command: string, args: string[], extraPaths: string[] = []): string | null {
  const path = commandOutput("which", [command], 10_000);
  if (path) {
    const value = version(command, args);
    return value ? `${path}\n${value}` : path;
  }

  for (const candidate of extraPaths) {
    if (!existsSync(candidate)) {
      continue;
    }
    const value = commandOutput(candidate, args, 10_000);
    return value ? `${candidate}\n${value}` : candidate;
  }

  return null;
}

function addToolCheck(
  checks: DoctorCheck[],
  tools: Record<string, string | null>,
  name: string,
  required: boolean,
  probe: () => string | null,
): void {
  const value = probe();
  tools[name] = value;
  checks.push({
    name,
    required,
    status: value ? "pass" : required ? "fail" : "warn",
    detail: value ?? "not available",
  });
}

export function runDoctor(): DoctorReport {
  const checks: DoctorCheck[] = [];
  const tools: Record<string, string | null> = {};

  checks.push({
    name: "platform",
    required: true,
    status: process.platform === "darwin" ? "pass" : "fail",
    detail: process.platform,
  });

  addToolCheck(checks, tools, "xcode-select", true, () => version("xcode-select", ["-p"]));
  addToolCheck(checks, tools, "xcodebuild", true, () => version("xcodebuild", ["-version"]));
  addToolCheck(checks, tools, "xcrun", true, () => version("xcrun", ["--version"]));
  addToolCheck(checks, tools, "simctl", true, () =>
    commandOk("xcrun", ["--find", "simctl"]) ? commandOutput("xcrun", ["--find", "simctl"]) : null,
  );
  addToolCheck(checks, tools, "xcresulttool", true, () =>
    commandOk("xcrun", ["--find", "xcresulttool"])
      ? commandOutput("xcrun", ["--find", "xcresulttool"])
      : null,
  );
  addToolCheck(checks, tools, "xctrace", false, () =>
    commandOk("xcrun", ["--find", "xctrace"]) ? commandOutput("xcrun", ["--find", "xctrace"]) : null,
  );
  addToolCheck(checks, tools, "idb", false, () =>
    versionFromPath("idb", ["--version"], [
      `${homedir()}/.local/bin/idb`,
      "/opt/homebrew/bin/idb",
      "/usr/local/bin/idb",
    ]),
  );
  addToolCheck(checks, tools, "idb_companion", false, () =>
    versionFromPath("idb_companion", ["--version"], [
      "/opt/homebrew/bin/idb_companion",
      "/usr/local/bin/idb_companion",
    ]),
  );
  addToolCheck(checks, tools, "xcbeautify", false, () => versionFromPath("xcbeautify", ["--version"]));
  addToolCheck(checks, tools, "xcodebuildmcp", false, () =>
    versionFromPath("xcodebuildmcp", ["--version"]),
  );
  addToolCheck(checks, tools, "maestro", false, () => versionFromPath("maestro", ["--version"]));

  if (tools.simctl) {
    const simctl = runCommand("xcrun", ["simctl", "list", "--json", "devices"], 30_000);
    checks.push({
      name: "simctl-list-devices",
      required: true,
      status: simctl.exitCode === 0 ? "pass" : "fail",
      detail: simctl.exitCode === 0 ? "devices listed" : simctl.stderr || simctl.error || "failed",
    });
  }

  const requiredFailed = checks.filter((check) => check.required && check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;

  return {
    command: "doctor",
    platform: process.platform,
    checks,
    tools,
    summary: {
      requiredFailed,
      warnings,
    },
  };
}
