import { describe, expect, it } from 'vitest';
import { ApiError, isMissingDependency } from './apiError';

describe('ApiError', () => {
  it('carries status, method, path and the backend code', () => {
    const err = new ApiError({
      status: 503,
      method: 'GET',
      path: '/api/forecasting/markets',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'transformer unreachable' },
    });
    expect(err.status).toBe(503);
    expect(err.method).toBe('GET');
    expect(err.path).toBe('/api/forecasting/markets');
    expect(err.code).toBe('MOD22_MARKETS_FAILED');
    expect(err.message).toContain('transformer unreachable');
  });

  it('is an instanceof Error so existing catch blocks still work', () => {
    const err = new ApiError({ status: 404, method: 'GET', path: '/x' });
    expect(err).toBeInstanceOf(Error);
  });

  it('falls back to a readable message when the body has none', () => {
    const err = new ApiError({ status: 404, method: 'GET', path: '/x' });
    expect(err.message).toBe('GET /x failed with 404');
  });

  it('recognises a missing-dependency code', () => {
    expect(isMissingDependency(new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate',
      body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'GROQ_API_KEY not set', dependency: 'groq' },
    }))).toBe(true);
    expect(isMissingDependency(new ApiError({
      status: 503, method: 'GET', path: '/x',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'boom' },
    }))).toBe(false);
  });

  it('classifies Spring\'s ai_service_unreachable as a missing dependency', () => {
    // The exact body ApiExceptionHandler produces — note `error`, not `code`.
    // Task 4 guaranteed this transport-failure path now also carries `dependency`.
    const err = new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate',
      body: { error: 'ai_service_unreachable', status: 503, message: 'Connection refused: localhost:8000', dependency: 'fastapi-sbert' },
    });
    expect(isMissingDependency(err)).toBe(true);
    expect(err.code).toBe('ai_service_unreachable');
  });

  it('prefers an explicit code over the error slug', () => {
    const err = new ApiError({
      status: 409, method: 'GET', path: '/x',
      body: { error: 'request_failed', code: 'MOD22_PROFILE_NOT_READY', message: 'no profile' },
    });
    expect(err.code).toBe('MOD22_PROFILE_NOT_READY');
  });

  it('does not misclassify ordinary Spring error slugs as missing dependencies', () => {
    for (const slug of ['validation_failed', 'unauthorized', 'forbidden', 'not_found', 'request_failed']) {
      const err = new ApiError({
        status: 400, method: 'GET', path: '/x',
        body: { error: slug, status: 400, message: 'boom' },
      });
      expect(isMissingDependency(err)).toBe(false);
    }
  });
});

describe('unavailability contract fields', () => {
  const contractBody = {
    code: 'MOD31_LLM_UNAVAILABLE',
    message: 'Caption generation is unavailable.',
    dependency: 'groq',
    cause: "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found",
    stage: 'fastapi-sbert/caption_agent -> spring/content/generate',
  };

  it('parses dependency, cause and stage off the body', () => {
    const err = new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate', body: contractBody,
    });

    expect(err.dependency).toBe('groq');
    expect(err.cause).toContain('404 model_not_found');
    expect(err.stage).toContain('spring/content/generate');
  });

  it('classifies anything carrying a dependency as a missing dependency', () => {
    const err = new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate', body: contractBody,
    });

    expect(isMissingDependency(err)).toBe(true);
  });

  it('does not classify an ordinary failure as a missing dependency', () => {
    const err = new ApiError({
      status: 500, method: 'GET', path: '/api/notifications',
      body: { code: 'MOD22_UNEXPECTED', message: 'boom' },
    });

    expect(isMissingDependency(err)).toBe(false);
  });

  it('ignores an empty dependency string', () => {
    const err = new ApiError({
      status: 503, method: 'GET', path: '/api/x', body: { code: 'X', dependency: '' },
    });

    expect(isMissingDependency(err)).toBe(false);
  });

  it('leaves the fields undefined when the body omits them', () => {
    const err = new ApiError({
      status: 500, method: 'GET', path: '/api/x', body: { code: 'X', message: 'y' },
    });

    expect(err.dependency).toBeUndefined();
    expect(err.cause).toBeUndefined();
    expect(err.stage).toBeUndefined();
  });

  it('survives a non-object body', () => {
    const err = new ApiError({
      status: 502, method: 'GET', path: '/api/x', body: '<html>Bad Gateway</html>',
    });

    expect(err.dependency).toBeUndefined();
    expect(isMissingDependency(err)).toBe(false);
    expect(err.status).toBe(502);
  });
});
