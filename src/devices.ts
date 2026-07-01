import { failure, type Envelope, success } from "./output.js";
import { runCommand } from "./shell.js";

export type DevicesReport = {
  command: "devices";
  simctl: unknown;
};

export function listDevices(): Envelope<DevicesReport> {
  const result = runCommand("xcrun", ["simctl", "list", "--json", "devices", "runtimes", "devicetypes"], 30_000);

  if (result.exitCode !== 0) {
    return failure({
      code: "COMMAND_FAILED",
      message: "Unable to list Simulator devices with simctl.",
      retryable: false,
      detail: {
        command: "xcrun simctl list --json devices runtimes devicetypes",
        stderr: result.stderr,
        error: result.error,
      },
    });
  }

  try {
    return success({
      command: "devices",
      simctl: JSON.parse(result.stdout) as unknown,
    });
  } catch (error) {
    return failure({
      code: "COMMAND_FAILED",
      message: "simctl returned non-JSON output.",
      retryable: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
