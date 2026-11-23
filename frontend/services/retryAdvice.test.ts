// frontend/services/retryAdvice.test.ts
import { describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { retryAdvice } from './retryAdvice';

function apiError(status: number, body: Record<string, unknown> = {}) {
  return new ApiError({ status, method: 'POST', path: '/api/forecasting/analyze', body });
}

describe('retryAdvice', () => {
  it('says wait on HTTP 429', () => {
    expect(retryAdvice(apiError(429))).toBe('wait');
  });

  it('says wait on a quota error code', () => {
    expect(retryAdvice(apiError(503, { code: 'MOD22_AI_QUOTA_EXCEEDED' }))).toBe('wait');
  });

  it('says wait when only the cause carries the ZeroGPU quota text', () => {
    const err = apiError(503, {
      code: 'MOD22_BILSTM_UNAVAILABLE',
      message: 'The BiLSTM + Transformer demand model is unavailable.',
      dependency: 'bilstm',
      cause:
        'inference failed for KR/coastal_island: You have exceeded your ZeroGPU runs limit. Subscribe to Hugging Face PRO',
    });
    expect(retryAdvice(err)).toBe('wait');
  });

  it('says retry on a plain 503', () => {
    expect(retryAdvice(apiError(503, { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' }))).toBe(
      'retry',
    );
  });

  it('says retry for anything that is not an ApiError', () => {
    expect(retryAdvice(new Error('offline'))).toBe('retry');
    expect(retryAdvice('boom')).toBe('retry');
    expect(retryAdvice(null)).toBe('retry');
  });
});
