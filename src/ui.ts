import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { failure, type Envelope, success } from "./output.js";
import { idbBaseArgs, resolveIdb } from "./tools.js";
import { runCommand, type CommandResult } from "./shell.js";

export type UiFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UiPoint = {
  x: number;
  y: number;
};

export type UiElement = {
  ref: string;
  path: string;
  label?: string;
  identifier?: string;
  type?: string;
  role?: string;
  roleDescription?: string;
  value?: string;
  title?: string;
  enabled?: boolean;
  frame?: UiFrame;
  center?: UiPoint;
};

export type UiDevice = {
  udid: string;
  name?: string;
  state?: string;
  osVersion?: string;
};

export type UiSnapshot = {
  command: "ui snapshot";
  device: UiDevice;
  count: number;
  elements: UiElement[];
  artifacts: {
    tree: string;
    elements: string;
  };
};

export type UiFindResult = {
  command: "ui find";
  device: UiDevice;
  count: number;
  matches: UiElement[];
  artifacts: UiSnapshot["artifacts"];
};

export type UiActionResult = {
  command: "ui tap" | "ui type" | "ui swipe";
  device: UiDevice;
  target?: UiElement | UiPoint;
  commandLine: string;
  artifacts?: UiSnapshot["artifacts"];
};

export type UiSelector = {
  text?: string;
  textField?: string;
  identifier?: string;
  role?: string;
  ref?: string;
  exact?: boolean;
};

export type UiSnapshotOptions = {
  device?: string;
  outDir?: string;
  limit?: number;
};

export type UiFindOptions = UiSnapshotOptions & UiSelector;

export type UiTapOptions = UiFindOptions & {
  x?: number;
  y?: number;
  duration?: number;
};

export type UiTypeOptions = UiFindOptions & {
  value: string;
};

export type UiSwipeOptions = UiSnapshotOptions & {
  direction?: "up" | "down" | "left" | "right";
  from?: string;
  to?: string;
  duration?: number;
  delta?: number;
};

type IdbTarget = {
  name?: string;
  udid?: string;
  state?: string;
  os_version?: string;
  type?: string;
};

type RawElement = {
  AXLabel?: unknown;
  AXUniqueId?: unknown;
  AXValue?: unknown;
  title?: unknown;
  type?: unknown;
  role?: unknown;
  role_description?: unknown;
  enabled?: unknown;
  frame?: unknown;
  children?: unknown;
};

function nowId(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(".", "").replace("Z", "Z");
}

function ensureOutDir(outDir?: string): string {
  const root = resolve(outDir ?? ".iosctl/ui", `${nowId()}-snapshot`);
  mkdirSync(root, { recursive: true });
  return root;
}

function parseJsonLines(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function idbUnavailable(): Envelope<never> {
  return failure({
    code: "MISSING_TOOL",
    message: "idb is required for semantic UI commands and was not found.",
    retryable: false,
  });
}

function idbCommand(args: string[], timeoutMs = 30_000): CommandResult {
  const idb = resolveIdb();
  if (!idb) {
    return {
      command: "idb",
      args,
      exitCode: null,
      stdout: "",
      stderr: "idb not found",
      error: "idb not found",
    };
  }
  return runCommand(idb, [...idbBaseArgs(), ...args], timeoutMs);
}

function commandLine(result: CommandResult): string {
  return [result.command, ...result.args].join(" ");
}

export function normalizeFrame(value: unknown): UiFrame | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const frame = value as Record<string, unknown>;
  const x = Number(frame.x);
  const y = Number(frame.y);
  const width = Number(frame.width);
  const height = Number(frame.height);

  if ([x, y, width, height].some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  return { x, y, width, height };
}

function centerOf(frame: UiFrame | undefined): UiPoint | undefined {
  if (!frame) {
    return undefined;
  }
  return {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  };
}

function intPoint(point: UiPoint): UiPoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function flattenAccessibilityTree(raw: unknown): UiElement[] {
  const roots = Array.isArray(raw) ? raw : [raw];
  const elements: UiElement[] = [];

  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== "object") {
      return;
    }

    const rawElement = node as RawElement;
    const frame = normalizeFrame(rawElement.frame);
    const element: UiElement = {
      ref: `e${elements.length + 1}`,
      path,
      label: stringValue(rawElement.AXLabel),
      identifier: stringValue(rawElement.AXUniqueId),
      type: stringValue(rawElement.type),
      role: stringValue(rawElement.role),
      roleDescription: stringValue(rawElement.role_description),
      value: stringValue(rawElement.AXValue),
      title: stringValue(rawElement.title),
      enabled: typeof rawElement.enabled === "boolean" ? rawElement.enabled : undefined,
      frame,
      center: centerOf(frame),
    };

    elements.push(element);

    if (Array.isArray(rawElement.children)) {
      rawElement.children.forEach((child, index) => visit(child, `${path}.${index}`));
    }
  }

  roots.forEach((root, index) => visit(root, String(index)));
  return elements;
}

function haystack(element: UiElement): string {
  return [
    element.label,
    element.identifier,
    element.type,
    element.role,
    element.roleDescription,
    element.value,
    element.title,
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesValue(actual: string | undefined, expected: string, exact?: boolean): boolean {
  if (!actual) {
    return false;
  }
  return exact ? actual === expected : actual.toLowerCase().includes(expected.toLowerCase());
}

export function findElements(elements: UiElement[], selector: UiSelector): UiElement[] {
  return elements.filter((element) => {
    if (selector.ref && element.ref !== selector.ref) {
      return false;
    }

    if (selector.identifier && !matchesValue(element.identifier, selector.identifier, selector.exact)) {
      return false;
    }

    const text = selector.text ?? selector.textField;
    if (text) {
      const textMatches =
        matchesValue(element.label, text, selector.exact) ||
        matchesValue(element.title, text, selector.exact) ||
        matchesValue(element.value, text, selector.exact);
      if (!textMatches) {
        return false;
      }
    }

    if (selector.role && !matchesValue(haystack(element), selector.role, false)) {
      return false;
    }

    return Boolean(selector.ref || selector.identifier || text || selector.role);
  });
}

function compactElements(elements: UiElement[], limit = 25): UiElement[] {
  return elements.slice(0, limit).map((element) => ({
    ref: element.ref,
    path: element.path,
    label: element.label,
    identifier: element.identifier,
    type: element.type,
    role: element.role,
    roleDescription: element.roleDescription,
    value: element.value,
    title: element.title,
    enabled: element.enabled,
    frame: element.frame,
    center: element.center,
  }));
}

function resolveDevice(device?: string): Envelope<UiDevice> {
  const idb = resolveIdb();
  if (!idb) {
    return idbUnavailable();
  }

  const result = runCommand(idb, [...idbBaseArgs(), "list-targets", "--json"], 30_000);
  if (result.exitCode !== 0) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "Unable to list idb targets.",
      retryable: true,
      detail: result.stderr || result.error,
    });
  }

  let targets: IdbTarget[];
  try {
    targets = parseJsonLines(result.stdout) as IdbTarget[];
  } catch (error) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "idb target list was not valid newline-delimited JSON.",
      retryable: true,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const booted = targets.filter((target) => target.state === "Booted");
  const selected = device
    ? targets.find((target) => target.udid === device) ??
      targets.find((target) => target.name?.toLowerCase() === device.toLowerCase())
    : booted.length === 1
      ? booted[0]
      : booted.find((target) => target.name?.toLowerCase().includes("iphone"));

  if (!selected?.udid) {
    return failure({
      code: "SIMULATOR_UNAVAILABLE",
      message: "No idb target matched the requested device.",
      retryable: false,
      detail: {
        requested: device,
        bootedTargets: booted.map((target) => ({
          name: target.name,
          udid: target.udid,
          osVersion: target.os_version,
        })),
      },
    });
  }

  return success({
    udid: selected.udid,
    name: selected.name,
    state: selected.state,
    osVersion: selected.os_version,
  });
}

function getFullSnapshot(device?: string, outDir?: string): Envelope<{ snapshot: UiSnapshot; raw: unknown }> {
  const resolved = resolveDevice(device);
  if (!resolved.ok) {
    return resolved;
  }

  const result = idbCommand(["ui", "describe-all", "--udid", resolved.data.udid, "--json", "--nested"], 30_000);
  if (result.exitCode !== 0) {
    return failure({
      code: "UI_TREE_UNAVAILABLE",
      message: "Unable to read accessibility tree with idb.",
      retryable: true,
      detail: result.stderr || result.error,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout) as unknown;
  } catch (error) {
    return failure({
      code: "UI_TREE_UNAVAILABLE",
      message: "idb returned non-JSON accessibility output.",
      retryable: true,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const artifactDir = ensureOutDir(outDir);
  const treePath = join(artifactDir, "ui-tree.json");
  const elementsPath = join(artifactDir, "elements.json");
  const elements = flattenAccessibilityTree(raw);
  writeFileSync(treePath, `${JSON.stringify(raw, null, 2)}\n`);
  writeFileSync(elementsPath, `${JSON.stringify(elements, null, 2)}\n`);

  return success({
    raw,
    snapshot: {
      command: "ui snapshot",
      device: resolved.data,
      count: elements.length,
      elements,
      artifacts: {
        tree: treePath,
        elements: elementsPath,
      },
    },
  });
}

export function uiSnapshot(options: UiSnapshotOptions): Envelope<UiSnapshot> {
  const full = getFullSnapshot(options.device, options.outDir);
  if (!full.ok) {
    return full;
  }

  return success({
    ...full.data.snapshot,
    elements: compactElements(full.data.snapshot.elements, options.limit),
  });
}

export function uiFind(options: UiFindOptions): Envelope<UiFindResult> {
  const full = getFullSnapshot(options.device, options.outDir);
  if (!full.ok) {
    return full;
  }

  const matches = findElements(full.data.snapshot.elements, options);
  return success({
    command: "ui find",
    device: full.data.snapshot.device,
    count: matches.length,
    matches: compactElements(matches, options.limit),
    artifacts: full.data.snapshot.artifacts,
  });
}

function parsePoint(value: string): UiPoint | null {
  const [xRaw, yRaw] = value.split(",");
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function selectedTarget(options: UiFindOptions): Envelope<{ snapshot: UiSnapshot; target: UiElement }> {
  const full = getFullSnapshot(options.device, options.outDir);
  if (!full.ok) {
    return full;
  }

  const matches = findElements(full.data.snapshot.elements, options).filter((element) => element.center);
  if (matches.length === 0) {
    return failure({
      code: "UI_ELEMENT_NOT_FOUND",
      message: "No tappable UI element matched the selector.",
      retryable: false,
      artifact: full.data.snapshot.artifacts.elements,
      detail: {
        selector: options,
      },
    });
  }

  return success({
    snapshot: full.data.snapshot,
    target: matches[0]!,
  });
}

export function uiTap(options: UiTapOptions): Envelope<UiActionResult> {
  const resolved = resolveDevice(options.device);
  if (!resolved.ok) {
    return resolved;
  }

  let target: UiElement | UiPoint;
  let artifacts: UiSnapshot["artifacts"] | undefined;
  if (typeof options.x === "number" && typeof options.y === "number") {
    target = { x: options.x, y: options.y };
  } else {
    const selected = selectedTarget({ ...options, device: resolved.data.udid });
    if (!selected.ok) {
      return selected;
    }
    target = selected.data.target;
    artifacts = selected.data.snapshot.artifacts;
  }

  const point = "ref" in target ? target.center : target;
  if (!point) {
    return failure({
      code: "INVALID_INPUT",
      message: "Tap target does not have coordinates.",
      retryable: false,
    });
  }

  const args = [
    "ui",
    "tap",
    String(intPoint(point).x),
    String(intPoint(point).y),
    "--udid",
    resolved.data.udid,
    "--json",
  ];
  if (options.duration !== undefined) {
    args.push("--duration", String(options.duration));
  }

  const result = idbCommand(args, 30_000);
  if (result.exitCode !== 0) {
    return failure({
      code: "COMMAND_FAILED",
      message: "idb tap failed.",
      retryable: true,
      detail: result.stderr || result.error,
    });
  }

  return success({
    command: "ui tap",
    device: resolved.data,
    target,
    commandLine: commandLine(result),
    artifacts,
  });
}

export function uiType(options: UiTypeOptions): Envelope<UiActionResult> {
  const resolved = resolveDevice(options.device);
  if (!resolved.ok) {
    return resolved;
  }

  let target: UiElement | undefined;
  let artifacts: UiSnapshot["artifacts"] | undefined;
  if (options.text || options.textField || options.identifier || options.ref || options.role) {
    const selected = selectedTarget({ ...options, device: resolved.data.udid });
    if (!selected.ok) {
      return selected;
    }
    target = selected.data.target;
    artifacts = selected.data.snapshot.artifacts;
    if (!target.center) {
      return failure({
        code: "INVALID_INPUT",
        message: "Text target does not have coordinates.",
        retryable: false,
      });
    }

    const tap = idbCommand([
      "ui",
      "tap",
      String(target.center.x),
      String(target.center.y),
      "--udid",
      resolved.data.udid,
      "--json",
    ]);
    if (tap.exitCode !== 0) {
      return failure({
        code: "COMMAND_FAILED",
        message: "idb tap before text input failed.",
        retryable: true,
        detail: tap.stderr || tap.error,
      });
    }
  }

  const result = idbCommand(["ui", "text", options.value, "--udid", resolved.data.udid, "--json"], 30_000);
  if (result.exitCode !== 0) {
    return failure({
      code: "COMMAND_FAILED",
      message: "idb text input failed.",
      retryable: true,
      detail: result.stderr || result.error,
    });
  }

  return success({
    command: "ui type",
    device: resolved.data,
    target,
    commandLine: commandLine(result),
    artifacts,
  });
}

function swipePoints(snapshot: UiSnapshot, options: UiSwipeOptions): Envelope<{ from: UiPoint; to: UiPoint }> {
  if (options.from && options.to) {
    const from = parsePoint(options.from);
    const to = parsePoint(options.to);
    if (!from || !to) {
      return failure({
        code: "INVALID_INPUT",
        message: "--from and --to must use x,y coordinates.",
        retryable: false,
      });
    }
    return success({ from, to });
  }

  const root = snapshot.elements.find((element) => element.type === "Application" && element.frame) ?? snapshot.elements[0];
  if (!root?.frame) {
    return failure({
      code: "UI_TREE_UNAVAILABLE",
      message: "Unable to infer screen bounds for directional swipe.",
      retryable: false,
      artifact: snapshot.artifacts.elements,
    });
  }

  const direction = options.direction ?? "up";
  const centerX = root.frame.x + root.frame.width / 2;
  const centerY = root.frame.y + root.frame.height / 2;
  const leftX = root.frame.x + root.frame.width * 0.25;
  const rightX = root.frame.x + root.frame.width * 0.75;
  const topY = root.frame.y + root.frame.height * 0.3;
  const bottomY = root.frame.y + root.frame.height * 0.7;

  const points = {
    up: { from: { x: centerX, y: bottomY }, to: { x: centerX, y: topY } },
    down: { from: { x: centerX, y: topY }, to: { x: centerX, y: bottomY } },
    left: { from: { x: rightX, y: centerY }, to: { x: leftX, y: centerY } },
    right: { from: { x: leftX, y: centerY }, to: { x: rightX, y: centerY } },
  } satisfies Record<string, { from: UiPoint; to: UiPoint }>;

  return success(points[direction]);
}

export function uiSwipe(options: UiSwipeOptions): Envelope<UiActionResult> {
  const full = getFullSnapshot(options.device, options.outDir);
  if (!full.ok) {
    return full;
  }

  const points = swipePoints(full.data.snapshot, options);
  if (!points.ok) {
    return points;
  }

  const from = intPoint(points.data.from);
  const to = intPoint(points.data.to);
  const args = [
    "ui",
    "swipe",
    String(from.x),
    String(from.y),
    String(to.x),
    String(to.y),
    "--udid",
    full.data.snapshot.device.udid,
    "--json",
  ];
  if (options.duration !== undefined) {
    args.push("--duration", String(options.duration));
  }
  if (options.delta !== undefined) {
    args.push("--delta", String(options.delta));
  }

  const result = idbCommand(args, 30_000);
  if (result.exitCode !== 0) {
    return failure({
      code: "COMMAND_FAILED",
      message: "idb swipe failed.",
      retryable: true,
      detail: result.stderr || result.error,
    });
  }

  return success({
    command: "ui swipe",
    device: full.data.snapshot.device,
    target: from,
    commandLine: commandLine(result),
    artifacts: full.data.snapshot.artifacts,
  });
}
