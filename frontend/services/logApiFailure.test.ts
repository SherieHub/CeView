// frontend/services/logApiFailure.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { logApiFailure } from './logApiFailure';

afterEach(() => vi.restoreAllMocks());

describe('logApiFailure', () => {
  it('logs the structured ApiError fields and the advice', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new ApiError({
      status: 503,
      method: 'POST',
      path: '/api/forecasting/analyze',
      body: {
        code: 'MOD22_BILSTM_UNAVAILABLE',
        dependency: 'bilstm',
        cause: 'You have exceeded your ZeroGPU runs limit',
        stage: 'inference',
      },
    });

    logApiFailure('Forecast refresh', err);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[CeView] Forecast refresh failed', {
      status: 503,
      method: 'POST',
      path: '/api/forecasting/analyze',
      code: 'MOD22_BILSTM_UNAVAILABLE',
      dependency: 'bilstm',
      cause: 'You have exceeded your ZeroGPU runs limit',
      stage: 'inference',
      advice: 'wait',
    });
  });

  it('logs the message of a plain Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logApiFailure('Dashboard load', new Error('offline'));
    expect(spy).toHaveBeenCalledWith('[CeView] Dashboard load failed', { message: 'offline', advice: 'retry' });
  });

  it('logs a non-Error value as a string', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logApiFailure('Business analysis', 'boom');
    expect(spy).toHaveBeenCalledWith('[CeView] Business analysis failed', { message: 'boom', advice: 'retry' });
  });
});
