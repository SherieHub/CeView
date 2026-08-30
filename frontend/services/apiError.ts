/**
 * Structured transport error. Spring returns { code, message } for module 2/3
 * failures and the AI gateway returns DEPENDENCY_* codes (see Task 5); this
 * class carries them to the UI instead of stringifying them away.
 */
export interface ApiErrorInit {
  status: number;
  method: string;
  path: string;
  body?: unknown;
}

function readString(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly code?: string;
  readonly body?: unknown;
  readonly dependency?: string;
  declare readonly cause?: string;
  readonly stage?: string;

  constructor({ status, method, path, body }: ApiErrorInit) {
    super(readString(body, 'message') ?? `${method} ${path} failed with ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.method = method;
    this.path = path;
    // Spring's ApiExceptionHandler puts its slug in `error` and only sets `code`
    // when MDC carries one, so AI failures arrive as { error: "ai_service_unreachable" }
    // with no code. Fall back to `error` so those still classify.
    this.code = readString(body, 'code') ?? readString(body, 'error');
    this.body = body;
    // The unavailability contract. `cause` is authored by the service that knows
    // why and is rendered verbatim — never re-worded here.
    this.dependency = readString(body, 'dependency');
    this.cause = readString(body, 'cause');
    this.stage = readString(body, 'stage');
  }
}

/**
 * "This dependency is unavailable", not "the request failed".
 *
 * Presence of `dependency` is the signal, replacing the hardcoded code allowlist
 * this function used to carry — enumerating codes meant every new backend code
 * had to be added here too, and was silently misclassified until someone noticed.
 */
export function isMissingDependency(err: unknown): boolean {
  return err instanceof ApiError && typeof err.dependency === 'string' && err.dependency.length > 0;
}

/** 409 from CurrentBusinessProfile — onboarding incomplete, not a failure. */
export function isProfileNotReady(err: unknown): boolean {
  return err instanceof ApiError
    && (err.status === 409 || err.code === 'MOD22_PROFILE_NOT_READY');
}
