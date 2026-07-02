import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { failure, type Envelope, success, type ErrorPayload } from "./output.js";
import { redactArgs } from "./redact.js";
import { runCommand, type CommandResult } from "./shell.js";

export type ProofRunOptions = {
  project?: string;
  workspace?: string;
  scheme: string;
  bundle: string;
  device?: string;
  runtime?: string;
  configuration: string;
  envFile?: string;
  outDir: string;
  screenshotName: string;
  settleMs: number;
  timeoutMs: number;
  argv: string[];
  cwd: string;
};

export type SelectedSimulator = {
  name: string;
  udid: string;
  state: string;
  runtimeIdentifier: string;
  runtimeName: string;
  runtimeVersion?: string;
};

type SimulatorDevice = {
  name?: string;
  udid?: string;
  state?: string;
  isAvailable?: boolean;
  availabilityError?: string;
};

type SimulatorRuntime = {
  identifier?: string;
  name?: string;
  version?: string;
  isAvailable?: boolean;
};

type SimulatorInventory = {
  devices?: Record<string, SimulatorDevice[]>;
  runtimes?: SimulatorRuntime[];
};

type StepReceipt = {
  name: string;
  ok: boolean;
  durationMs: number;
  command?: string;
  exitCode?: number | null;
  artifact?: string;
  detail?: string;
};

type ProofReceipt = {
  runId: string;
  command: "proof-run";
  ok: boolean;
  argv: string[];
  cwd: string;
  startedAt: string;
  finishedAt: string;
  options: {
    project?: string;
    workspace?: string;
    scheme: string;
    bundle: string;
    device?: string;
    runtime?: string;
    configuration: string;
    envFileKeys: string[];
  };
  simulator?: SelectedSimulator;
  appPath?: string;
  artifacts: Record<string, string>;
  steps: StepReceipt[];
  error?: ErrorPayload;
};

export type ProofRunReport = {
  command: "proof-run";
  runId: string;
  runDir: string;
  simulator: SelectedSimulator;
  appPath: string;
  artifacts: Record<string, string>;
  steps: StepReceipt[];
};

type MutableProofState = {
  runId: string;
  runDir: string;
  startedAt: string;
  options: ProofRunOptions;
  envFileKeys: string[];
  artifacts: Record<string, string>;
  steps: StepReceipt[];
  simulator?: SelectedSimulator;
  appPath?: string;
};

export function makeRunId(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${timestamp}-proof-run`;
}

function resolveInputPath(cwd: string, input: string): string {
  return resolve(cwd, input);
}

export function parseEnvFile(filePath: string): { env: Record<string, string>; keys: string[] } {
  const text = readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      env[key] = value;
    }
  }

  return { env, keys: Object.keys(env).sort() };
}

function runtimeMatches(runtime: SimulatorRuntime | undefined, runtimeIdentifier: string, desired?: string): boolean {
  if (!desired) {
    return true;
  }

  const needle = desired.toLowerCase().replace(/\s+/g, "");
  const haystack = [
    runtimeIdentifier,
    runtime?.identifier,
    runtime?.name,
    runtime?.version,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");

  return haystack.includes(needle);
}

function compareVersionsDesc(a: SelectedSimulator, b: SelectedSimulator): number {
  const aParts = (a.runtimeVersion ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const bParts = (b.runtimeVersion ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const delta = (bParts[index] ?? 0) - (aParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return a.name.localeCompare(b.name);
}

export function selectSimulator(
  inventory: SimulatorInventory,
  desiredDevice?: string,
  desiredRuntime?: string,
): SelectedSimulator | null {
  const runtimeById = new Map<string, SimulatorRuntime>();
  for (const runtime of inventory.runtimes ?? []) {
    if (runtime.identifier) {
      runtimeById.set(runtime.identifier, runtime);
    }
  }

  const candidates: SelectedSimulator[] = [];
  for (const [runtimeIdentifier, devices] of Object.entries(inventory.devices ?? {})) {
    const runtime = runtimeById.get(runtimeIdentifier);
    if (runtime?.isAvailable === false || !runtimeMatches(runtime, runtimeIdentifier, desiredRuntime)) {
      continue;
    }

    for (const device of devices) {
      if (!device.name || !device.udid || device.isAvailable === false || device.availabilityError) {
        continue;
      }

      if (desiredDevice && device.name.toLowerCase() !== desiredDevice.toLowerCase()) {
        continue;
      }

      if (!desiredDevice && !device.name.toLowerCase().includes("iphone")) {
        continue;
      }

      candidates.push({
        name: device.name,
        udid: device.udid,
        state: device.state ?? "Unknown",
        runtimeIdentifier,
        runtimeName: runtime?.name ?? runtimeIdentifier,
        runtimeVersion: runtime?.version,
      });
    }
  }

  candidates.sort(compareVersionsDesc);
  return candidates[0] ?? null;
}

function ensureRunDir(outDir: string, runId: string): string {
  const runDir = resolve(outDir, runId);
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
}

function commandLine(result: CommandResult): string {
  return [result.command, ...redactArgs(result.args)].join(" ");
}

function stepFromResult(name: string, result: CommandResult, started: number, artifact?: string): StepReceipt {
  return {
    name,
    ok: result.exitCode === 0,
    durationMs: Date.now() - started,
    command: commandLine(result),
    exitCode: result.exitCode,
    artifact,
    detail: result.exitCode === 0 ? undefined : result.stderr || result.error || "command failed",
  };
}

function writeCommandLog(path: string, result: CommandResult): void {
  const body = [
    `$ ${commandLine(result)}`,
    "",
    "## stdout",
    result.stdout || "(empty)",
    "",
    "## stderr",
    result.stderr || "(empty)",
    "",
    `exitCode: ${result.exitCode}`,
    result.error ? `error: ${result.error}` : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
  writeText(path, body);
}

function writeReceipt(state: MutableProofState, ok: boolean, error?: ErrorPayload): ProofReceipt {
  const receipt: ProofReceipt = {
    runId: state.runId,
    command: "proof-run",
    ok,
    argv: redactArgs(state.options.argv),
    cwd: state.options.cwd,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    options: {
      project: state.options.project,
      workspace: state.options.workspace,
      scheme: state.options.scheme,
      bundle: state.options.bundle,
      device: state.options.device,
      runtime: state.options.runtime,
      configuration: state.options.configuration,
      envFileKeys: state.envFileKeys,
    },
    simulator: state.simulator,
    appPath: state.appPath,
    artifacts: state.artifacts,
    steps: state.steps,
    error,
  };
  writeJson(state.artifacts.receipt, receipt);
  writeSummary(state, ok, error);
  return receipt;
}

function writeSummary(state: MutableProofState, ok: boolean, error?: ErrorPayload): void {
  const lines = [
    "# iosctl Proof Run",
    "",
    `- Run: ${state.runId}`,
    `- Status: ${ok ? "ok" : "failed"}`,
    `- Scheme: ${state.options.scheme}`,
    `- Bundle: ${state.options.bundle}`,
    state.simulator
      ? `- Simulator: ${state.simulator.name} (${state.simulator.runtimeName}, ${state.simulator.udid})`
      : "- Simulator: unresolved",
    state.appPath ? `- App: ${state.appPath}` : "- App: unresolved",
    "",
    "## Artifacts",
    ...Object.entries(state.artifacts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Steps",
    ...state.steps.map((step) => `- ${step.ok ? "ok" : "fail"} ${step.name} (${step.durationMs}ms)`),
    error ? "" : undefined,
    error ? "## Error" : undefined,
    error ? `- ${error.code}: ${error.message}` : undefined,
  ].filter((line): line is string => line !== undefined);
  writeText(state.artifacts.summary, lines.join("\n"));
}

function fail(state: MutableProofState, error: ErrorPayload): Envelope<ProofRunReport> {
  writeReceipt(state, false, error);
  return failure({
    ...error,
    artifact: error.artifact ?? state.artifacts.receipt,
  });
}

function loadSimulatorInventory(timeoutMs: number): Envelope<SimulatorInventory> {
  const result = runCommand("xcrun", ["simctl", "list", "--json", "devices", "runtimes"], timeoutMs);
  if (result.exitCode !== 0) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "Unable to read Simulator inventory.",
      retryable: true,
      detail: result.stderr || result.error,
    });
  }

  try {
    return success(JSON.parse(result.stdout) as SimulatorInventory);
  } catch (error) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "Simulator inventory was not valid JSON.",
      retryable: true,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function bootSimulator(state: MutableProofState): Envelope<null> {
  if (!state.simulator) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "No Simulator selected.",
      retryable: false,
    });
  }

  if (state.simulator.state !== "Booted") {
    const bootStarted = Date.now();
    const boot = runCommand("xcrun", ["simctl", "boot", state.simulator.udid], state.options.timeoutMs);
    state.steps.push(stepFromResult("simulator-boot", boot, bootStarted));
    if (boot.exitCode !== 0) {
      return failure({
        code: "SIMULATOR_UNAVAILABLE",
        message: "Unable to boot selected Simulator.",
        retryable: true,
        detail: boot.stderr || boot.error,
      });
    }
  }

  const bootStatusStarted = Date.now();
  const bootStatus = runCommand("xcrun", ["simctl", "bootstatus", state.simulator.udid, "-b"], {
    timeoutMs: Math.max(180_000, state.options.timeoutMs),
  });
  state.steps.push(stepFromResult("simulator-bootstatus", bootStatus, bootStatusStarted));
  if (bootStatus.exitCode !== 0) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "Selected Simulator did not finish booting.",
      retryable: true,
      detail: bootStatus.stderr || bootStatus.error,
    });
  }

  return success(null);
}

function buildArgs(state: MutableProofState, simulator: SelectedSimulator, derivedDataPath: string, resultBundlePath: string): string[] {
  const sourceArgs = state.options.project
    ? ["-project", state.options.project]
    : ["-workspace", state.options.workspace ?? ""];

  return [
    ...sourceArgs,
    "-scheme",
    state.options.scheme,
    "-configuration",
    state.options.configuration,
    "-destination",
    `platform=iOS Simulator,id=${simulator.udid}`,
    "-derivedDataPath",
    derivedDataPath,
    "-resultBundlePath",
    resultBundlePath,
    "build",
  ];
}

function findAppBundles(root: string, acc: string[] = []): string[] {
  if (!existsSync(root)) {
    return acc;
  }

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory() && extname(path) === ".app") {
      acc.push(path);
      continue;
    }
    if (stats.isDirectory()) {
      findAppBundles(path, acc);
    }
  }
  return acc;
}

function findBuiltApp(derivedDataPath: string, configuration: string, scheme: string): string | null {
  const productsDir = join(derivedDataPath, "Build", "Products");
  const exact = join(productsDir, `${configuration}-iphonesimulator`, `${scheme}.app`);
  if (existsSync(exact)) {
    return exact;
  }

  const apps = findAppBundles(productsDir);
  apps.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return apps[0] ?? null;
}

function sleepMs(ms: number): void {
  if (ms <= 0) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function validateOptions(options: ProofRunOptions): ErrorPayload | null {
  if (!options.project && !options.workspace) {
    return {
      code: "INVALID_INPUT",
      message: "Pass exactly one of --project or --workspace.",
      retryable: false,
    };
  }

  if (options.project && options.workspace) {
    return {
      code: "INVALID_INPUT",
      message: "Pass only one of --project or --workspace.",
      retryable: false,
    };
  }

  if (!options.scheme) {
    return {
      code: "INVALID_INPUT",
      message: "--scheme is required.",
      retryable: false,
    };
  }

  if (!options.bundle) {
    return {
      code: "INVALID_INPUT",
      message: "--bundle is required.",
      retryable: false,
    };
  }

  const sourcePath = options.project ?? options.workspace;
  if (sourcePath && !existsSync(sourcePath)) {
    return {
      code: "INVALID_INPUT",
      message: `Xcode ${options.project ? "project" : "workspace"} path does not exist.`,
      retryable: false,
      detail: sourcePath,
    };
  }

  if (options.envFile && !existsSync(options.envFile)) {
    return {
      code: "INVALID_INPUT",
      message: "Env file does not exist.",
      retryable: false,
      detail: options.envFile,
    };
  }

  return null;
}

export function normalizeProofRunOptions(input: Partial<ProofRunOptions>, cwd = process.cwd()): ProofRunOptions {
  return {
    project: input.project ? resolveInputPath(cwd, input.project) : undefined,
    workspace: input.workspace ? resolveInputPath(cwd, input.workspace) : undefined,
    scheme: input.scheme ?? "",
    bundle: input.bundle ?? "",
    device: input.device,
    runtime: input.runtime,
    configuration: input.configuration ?? "Debug",
    envFile: input.envFile ? resolveInputPath(cwd, input.envFile) : undefined,
    outDir: input.outDir ? resolveInputPath(cwd, input.outDir) : resolveInputPath(cwd, ".iosctl/runs"),
    screenshotName: input.screenshotName ?? "launch",
    settleMs: input.settleMs ?? 3_000,
    timeoutMs: input.timeoutMs ?? 600_000,
    argv: input.argv ?? [],
    cwd,
  };
}

export function runProofRun(input: Partial<ProofRunOptions>): Envelope<ProofRunReport> {
  const options = normalizeProofRunOptions(input);
  const runId = makeRunId();
  const runDir = ensureRunDir(options.outDir, runId);
  const state: MutableProofState = {
    runId,
    runDir,
    startedAt: new Date().toISOString(),
    options,
    envFileKeys: [],
    artifacts: {
      receipt: join(runDir, "receipt.json"),
      summary: join(runDir, "summary.md"),
      buildLog: join(runDir, "build.log"),
      appLog: join(runDir, "app.log"),
      screenshot: join(runDir, `screenshot-${options.screenshotName}.png`),
      derivedData: join(runDir, "DerivedData"),
      resultBundle: join(runDir, "xcodebuild.xcresult"),
    },
    steps: [],
  };

  const invalid = validateOptions(options);
  if (invalid) {
    return fail(state, invalid);
  }

  let launchEnv = process.env;
  if (options.envFile) {
    const parsed = parseEnvFile(options.envFile);
    state.envFileKeys = parsed.keys;
    launchEnv = { ...process.env };
    for (const [key, value] of Object.entries(parsed.env)) {
      launchEnv[`SIMCTL_CHILD_${key}`] = value;
    }
  }

  const inventory = loadSimulatorInventory(options.timeoutMs);
  if (!inventory.ok) {
    return fail(state, inventory.error);
  }

  const simulator = selectSimulator(inventory.data, options.device, options.runtime);
  if (!simulator) {
    return fail(state, {
      code: "DESTINATION_UNAVAILABLE",
      message: "No available iOS Simulator matched the requested device/runtime.",
      retryable: false,
      detail: {
        device: options.device,
        runtime: options.runtime,
      },
    });
  }
  state.simulator = simulator;

  const booted = bootSimulator(state);
  if (!booted.ok) {
    return fail(state, booted.error);
  }

  const buildStarted = Date.now();
  const build = runCommand(
    "xcodebuild",
    buildArgs(state, simulator, state.artifacts.derivedData, state.artifacts.resultBundle),
    options.timeoutMs,
  );
  writeCommandLog(state.artifacts.buildLog, build);
  state.steps.push(stepFromResult("xcodebuild-build", build, buildStarted, state.artifacts.buildLog));
  if (build.exitCode !== 0) {
    return fail(state, {
      code: "COMMAND_FAILED",
      message: "xcodebuild build failed.",
      retryable: false,
      artifact: state.artifacts.buildLog,
      detail: build.stderr || build.error,
    });
  }

  const appPath = findBuiltApp(state.artifacts.derivedData, options.configuration, options.scheme);
  if (!appPath) {
    return fail(state, {
      code: "APP_NOT_FOUND",
      message: "Unable to locate built .app bundle in DerivedData products.",
      retryable: false,
      artifact: state.artifacts.derivedData,
    });
  }
  state.appPath = appPath;

  const installStarted = Date.now();
  const install = runCommand("xcrun", ["simctl", "install", simulator.udid, appPath], options.timeoutMs);
  state.steps.push(stepFromResult("simctl-install", install, installStarted));
  if (install.exitCode !== 0) {
    return fail(state, {
      code: "COMMAND_FAILED",
      message: "simctl install failed.",
      retryable: true,
      detail: install.stderr || install.error,
    });
  }

  const launchStarted = Date.now();
  const launch = runCommand(
    "xcrun",
    ["simctl", "launch", "--terminate-running-process", simulator.udid, options.bundle],
    { timeoutMs: options.timeoutMs, env: launchEnv },
  );
  writeCommandLog(state.artifacts.appLog, launch);
  state.steps.push(stepFromResult("simctl-launch", launch, launchStarted, state.artifacts.appLog));
  if (launch.exitCode !== 0) {
    return fail(state, {
      code: "BUNDLE_LAUNCH_FAILED",
      message: "simctl launch failed.",
      retryable: true,
      artifact: state.artifacts.appLog,
      detail: launch.stderr || launch.error,
    });
  }

  sleepMs(options.settleMs);

  const screenshotStarted = Date.now();
  const screenshot = runCommand(
    "xcrun",
    ["simctl", "io", simulator.udid, "screenshot", state.artifacts.screenshot],
    options.timeoutMs,
  );
  state.steps.push(stepFromResult("simctl-screenshot", screenshot, screenshotStarted, state.artifacts.screenshot));
  if (screenshot.exitCode !== 0) {
    return fail(state, {
      code: "COMMAND_FAILED",
      message: "simctl screenshot failed.",
      retryable: true,
      detail: screenshot.stderr || screenshot.error,
    });
  }

  writeReceipt(state, true);

  return success({
    command: "proof-run",
    runId: state.runId,
    runDir: state.runDir,
    simulator,
    appPath,
    artifacts: state.artifacts,
    steps: state.steps,
  });
}

export function appProcessName(appPath: string): string {
  return basename(appPath, ".app");
}
