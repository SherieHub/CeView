/**
 * The public interactive demo (/demo) runs the real CeView screens on sample
 * data. While it is active, apiClient answers from the demo's own in-browser
 * data layer and never calls the backend: no request leaves the browser and
 * no sign-in token is sent, whoever is visiting. Any call the demo doesn't
 * provide is refused with a "not in the demo" error instead of falling
 * through to the network — the demo cannot reach an endpoint by accident.
 *
 * The backend is unchanged and still requires a signed-in operator for every
 * route; the demo just never asks it.
 *
 * Kept free of imports from the demo itself, so the main bundle carries only
 * this switch — the sample data loads with the /demo chunk.
 */
import { ApiError } from './apiError';

/** Any subset of apiClient's namespaces and methods. */
export type DemoApi = Record<string, Record<string, (...args: never[]) => unknown>>;

let active: DemoApi | null = null;

export function activateDemo(api: DemoApi): void {
  active = api;
}

export function deactivateDemo(api?: DemoApi): void {
  // Only the activation that is ending may switch the demo off.
  if (!api || active === api) active = null;
}

export function isDemoActive(): boolean {
  return active !== null;
}

export function demoUnavailable(name: string): ApiError {
  return new ApiError({
    status: 404,
    method: 'DEMO',
    path: name,
    body: {
      code: 'DEMO_UNAVAILABLE',
      message: 'This isn’t part of the interactive demo — it needs a real CeView account.',
    },
  });
}

/**
 * Wraps every method of every namespace (except those listed in `passthrough`)
 * so that, while the demo is active, it answers from the demo API or rejects.
 * Outside the demo each wrapper calls straight through to the real method.
 */
export function guardForDemo<T extends Record<string, Record<string, unknown>>>(
  client: T,
  passthrough: readonly (keyof T)[],
): T {
  const guarded: Record<string, Record<string, unknown>> = {};
  for (const [ns, methods] of Object.entries(client)) {
    if (passthrough.includes(ns)) {
      guarded[ns] = methods;
      continue;
    }
    const wrapped: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(methods)) {
      if (typeof fn !== 'function') {
        wrapped[name] = fn;
        continue;
      }
      wrapped[name] = (...args: unknown[]) => {
        if (active) {
          const demoFn = active[ns]?.[name] as ((...a: unknown[]) => unknown) | undefined;
          return demoFn ? demoFn(...args) : Promise.reject(demoUnavailable(`${ns}.${name}`));
        }
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    guarded[ns] = wrapped;
  }
  return guarded as T;
}
