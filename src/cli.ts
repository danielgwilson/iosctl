#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { listDevices } from "./devices.js";
import { runDoctor } from "./doctor.js";
import { exitForEnvelope, failure, success, writeEnvelope, type Envelope } from "./output.js";

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
  .description("Planned: build, install, launch, screenshot, and write a proof receipt")
  .option("--json", "emit exactly one JSON object on stdout")
  .action((options: { json?: boolean }) => {
    emitAndExit(notImplemented("proof-run"), Boolean(options.json));
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
