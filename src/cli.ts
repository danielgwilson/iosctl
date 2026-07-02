#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { listDevices } from "./devices.js";
import { runDoctor } from "./doctor.js";
import { exitForEnvelope, failure, success, writeEnvelope, type Envelope } from "./output.js";
import { runProofRun } from "./proofRun.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

function emitAndExit<T>(envelope: Envelope<T>, asJson: boolean): never {
  writeEnvelope(envelope, asJson);
  process.exit(exitForEnvelope(envelope));
}

function notImplemented(command: string): Envelope<{ command: string }> {
  return failure({
    code: "NOT_IMPLEMENTED",
    message: `${command} is specified but not implemented in this scaffold yet.`,
    retryable: false,
  });
}

const program = new Command();

program
  .name("iosctl")
  .description("Agent-first CLI for native iOS Simulator build, run, and proof loops")
  .version(packageJson.version);

program
  .command("doctor")
  .description("Check local iOS development capabilities")
  .option("--json", "emit exactly one JSON object on stdout")
  .action((options: { json?: boolean }) => {
    const report = runDoctor();
    const envelope =
      report.summary.requiredFailed === 0
        ? success(report)
        : failure({
            code: "CHECK_FAILED",
            message: `${report.summary.requiredFailed} required iosctl doctor check(s) failed.`,
            retryable: false,
            detail: report,
          });
    emitAndExit(envelope, Boolean(options.json));
  });

program
  .command("devices")
  .description("List available Simulator devices, runtimes, and device types")
  .option("--json", "emit exactly one JSON object on stdout")
  .action((options: { json?: boolean }) => {
    emitAndExit(listDevices(), Boolean(options.json));
  });

program
  .command("proof-run")
  .description("Build, install, launch, screenshot, and write a proof receipt")
  .option("--project <path>", "Xcode project path")
  .option("--workspace <path>", "Xcode workspace path")
  .requiredOption("--scheme <scheme>", "Xcode scheme")
  .requiredOption("--bundle <bundleId>", "bundle identifier to launch")
  .option("--device <name>", "Simulator device name, for example iPhone 17 Pro")
  .option("--runtime <runtime>", "Simulator runtime name or version, for example iOS 26")
  .option("--configuration <configuration>", "Xcode build configuration", "Debug")
  .option("--env-file <path>", "env file for launch; values are passed as SIMCTL_CHILD_* and redacted from receipts")
  .option("--out-dir <path>", "artifact run root", ".iosctl/runs")
  .option("--screenshot <name>", "screenshot label", "launch")
  .option("--settle-ms <ms>", "milliseconds to wait after launch before screenshot", (value) => Number.parseInt(value, 10), 3000)
  .option("--timeout-ms <ms>", "per-command timeout in milliseconds", (value) => Number.parseInt(value, 10), 600000)
  .option("--json", "emit exactly one JSON object on stdout")
  .action(
    (options: {
      project?: string;
      workspace?: string;
      scheme: string;
      bundle: string;
      device?: string;
      runtime?: string;
      configuration: string;
      envFile?: string;
      outDir: string;
      screenshot: string;
      settleMs: number;
      timeoutMs: number;
      json?: boolean;
    }) => {
      emitAndExit(
        runProofRun({
          project: options.project,
          workspace: options.workspace,
          scheme: options.scheme,
          bundle: options.bundle,
          device: options.device,
          runtime: options.runtime,
          configuration: options.configuration,
          envFile: options.envFile,
          outDir: options.outDir,
          screenshotName: options.screenshot,
          settleMs: options.settleMs,
          timeoutMs: options.timeoutMs,
          argv: process.argv.slice(2),
        }),
        Boolean(options.json),
      );
  });

program
  .command("ui")
  .description("Planned: semantic UI snapshot/find/tap/type/swipe commands")
  .option("--json", "emit exactly one JSON object on stdout")
  .action((options: { json?: boolean }) => {
    emitAndExit(notImplemented("ui"), Boolean(options.json));
  });

program
  .command("contract")
  .description("Print the current CLI contract summary")
  .option("--json", "emit exactly one JSON object on stdout")
  .action((options: { json?: boolean }) => {
    emitAndExit(
      success({
        command: "contract",
        jsonStdout: "exactly one JSON object when --json is passed",
        progress: "stderr",
        exitCodes: {
          0: "success",
          1: "operation failed",
          2: "invalid input, missing capability, or user action required",
          3: "safety refusal",
        },
      }),
      Boolean(options.json),
    );
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  emitAndExit(
    failure({
      code: "COMMAND_FAILED",
      message,
      retryable: false,
    }),
    process.argv.includes("--json"),
  );
});
