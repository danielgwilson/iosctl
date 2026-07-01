export type ExitCode = 0 | 1 | 2 | 3;

export type ErrorPayload = {
  code: string;
  message: string;
  retryable: boolean;
  artifact?: string;
  detail?: unknown;
};

export type SuccessEnvelope<T> = {
  ok: true;
  data: T;
};

export type FailureEnvelope = {
  ok: false;
  error: ErrorPayload;
};

export type Envelope<T> = SuccessEnvelope<T> | FailureEnvelope;

export function success<T>(data: T): SuccessEnvelope<T> {
  return { ok: true, data };
}

export function failure(error: ErrorPayload): FailureEnvelope {
  return { ok: false, error };
}

export function writeEnvelope<T>(envelope: Envelope<T>, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
    return;
  }

  if (envelope.ok) {
    process.stdout.write(`${JSON.stringify(envelope.data, null, 2)}\n`);
    return;
  }

  process.stderr.write(`${envelope.error.code}: ${envelope.error.message}\n`);
}

export function exitForEnvelope<T>(envelope: Envelope<T>, fallback: ExitCode = 1): ExitCode {
  if (envelope.ok) {
    return 0;
  }

  if (envelope.error.code === "INVALID_INPUT" || envelope.error.code === "MISSING_TOOL") {
    return 2;
  }

  if (envelope.error.code === "SAFETY_REFUSAL") {
    return 3;
  }

  if (envelope.error.code === "NOT_IMPLEMENTED") {
    return 2;
  }

  return fallback;
}
