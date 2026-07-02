#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { listDevices } from "./devices.js";
import { runDoctor } from "./doctor.js";
import { exitForEnvelope, failure, success, writeEnvelope, type Envelope } from "./output.js";
import { runProofRun } from "./proofRun.js";
import { uiFind, uiSnapshot, uiSwipe, uiTap, uiType } from "./ui.js";

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

function parseInteger(value: string): number {
  return Number.parseInt(value, 10);
}

function parseNumber(value: string): number {
  return Number(value);
}

function commonUiOptions(command: Command): Command {
  return command
    .option("--device <udidOrName>", "target Simulator UDID or exact device name")
    .option("--out-dir <path>", "artifact root for raw UI tree snapshots", ".iosctl/ui")
    .option("--limit <count>", "maximum elements returned in stdout", parseInteger, 25)
    .option("--json", "emit exactly one JSON object on stdout");
}

function selectorOptions(command: Command): Command {
  return command
    .option("--text <text>", "match element label/title/value")
    .option("--text-field <label>", "match a text-field-like element by label/title/value")
    .option("--identifier <identifier>", "match accessibility identifier")
    .option("--role <role>", "match role/type/role description")
    .option("--ref <ref>", "match compact element ref from a fresh snapshot")
    .option("--exact", "require exact text/identifier matches");
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
  .option("--settle-ms <ms>", "milliseconds to wait after launch before screenshot", parseInteger, 3000)
  .option("--timeout-ms <ms>", "per-command timeout in milliseconds", parseInteger, 600000)
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

const ui = program
  .command("ui")
  .description("Semantic UI snapshot/find/tap/type/swipe commands backed by idb accessibility data");

commonUiOptions(ui.command("snapshot").description("Capture and normalize the current accessibility tree"))
  .action((options: { device?: string; outDir?: string; limit: number; json?: boolean }) => {
    emitAndExit(
      uiSnapshot({
        device: options.device,
        outDir: options.outDir,
        limit: options.limit,
      }),
      Boolean(options.json),
    );
  });

selectorOptions(commonUiOptions(ui.command("find").description("Find elements in the current accessibility tree")))
  .action(
    (options: {
      device?: string;
      outDir?: string;
      limit: number;
      text?: string;
      textField?: string;
      identifier?: string;
      role?: string;
      ref?: string;
      exact?: boolean;
      json?: boolean;
    }) => {
      emitAndExit(uiFind(options), Boolean(options.json));
    },
  );

selectorOptions(commonUiOptions(ui.command("tap").description("Tap by selector, ref, or explicit x/y coordinates")))
  .option("--x <number>", "x coordinate", parseNumber)
  .option("--y <number>", "y coordinate", parseNumber)
  .option("--duration <seconds>", "press duration", parseNumber)
  .action(
    (options: {
      device?: string;
      outDir?: string;
      limit: number;
      text?: string;
      textField?: string;
      identifier?: string;
      role?: string;
      ref?: string;
      exact?: boolean;
      x?: number;
      y?: number;
      duration?: number;
      json?: boolean;
    }) => {
      emitAndExit(uiTap(options), Boolean(options.json));
    },
  );

selectorOptions(commonUiOptions(ui.command("type").description("Optionally tap a selector, then type text")))
  .requiredOption("--value <text>", "text to input")
  .action(
    (options: {
      device?: string;
      outDir?: string;
      limit: number;
      text?: string;
      textField?: string;
      identifier?: string;
      role?: string;
      ref?: string;
      exact?: boolean;
      value: string;
      json?: boolean;
    }) => {
      emitAndExit(uiType(options), Boolean(options.json));
    },
  );

commonUiOptions(ui.command("swipe").description("Swipe by direction or explicit --from/--to coordinates"))
  .option("--direction <direction>", "up, down, left, or right", "up")
  .option("--from <x,y>", "start coordinate")
  .option("--to <x,y>", "end coordinate")
  .option("--duration <seconds>", "swipe duration", parseNumber)
  .option("--delta <pixels>", "pixels between touch points", parseNumber)
  .action(
    (options: {
      device?: string;
      outDir?: string;
      limit: number;
      direction?: string;
      from?: string;
      to?: string;
      duration?: number;
      delta?: number;
      json?: boolean;
    }) => {
      const direction = options.direction;
      if (direction && !["up", "down", "left", "right"].includes(direction)) {
        emitAndExit(
          failure({
            code: "INVALID_INPUT",
            message: "--direction must be one of up, down, left, or right.",
            retryable: false,
          }),
          Boolean(options.json),
        );
      }

      emitAndExit(
        uiSwipe({
          ...options,
          direction: direction as "up" | "down" | "left" | "right" | undefined,
        }),
        Boolean(options.json),
      );
    },
  );

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
