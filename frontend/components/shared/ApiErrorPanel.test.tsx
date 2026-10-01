import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiError';
import { ApiErrorPanel } from './ApiErrorPanel';

describe('ApiErrorPanel', () => {
  it('names the missing dependency and does not show a retry', () => {
    render(<ApiErrorPanel error={new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate',
      body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'GROQ_API_KEY is not set', dependency: 'groq' },
    })} />);
    expect(screen.getByText(/groq is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/GROQ_API_KEY is not set/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('treats profile-not-ready as guidance, not failure', () => {
    render(<ApiErrorPanel error={new ApiError({
      status: 409, method: 'GET', path: '/api/forecasting/markets',
      body: { code: 'MOD22_PROFILE_NOT_READY', message: 'no business profile yet' },
    })} />);
    expect(screen.getByText(/complete onboarding/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('shows status, method, path and backend code for a genuine failure', () => {
    render(<ApiErrorPanel error={new ApiError({
      status: 503, method: 'GET', path: '/api/forecasting/markets',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'transformer unreachable' },
    })} />);
    expect(screen.getByText(/GET \/api\/forecasting\/markets/)).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();
    expect(screen.getByText(/MOD22_MARKETS_FAILED/)).toBeInTheDocument();
  });

  it('renders a retry button when onRetry is supplied', () => {
    render(<ApiErrorPanel
      error={new ApiError({ status: 500, method: 'GET', path: '/x' })}
      onRetry={() => {}}
    />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('unavailability contract rendering', () => {
  const unavailable = new ApiError({
    status: 503,
    method: 'POST',
    path: '/api/content/generate',
    body: {
      code: 'MOD31_LLM_UNAVAILABLE',
      message: 'Caption generation is unavailable.',
      dependency: 'groq',
      cause: "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found",
      stage: 'fastapi-sbert/caption_agent -> spring/content/generate',
    },
  });

  it('names the dependency in the heading', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByRole('alert')).toHaveTextContent('groq is unavailable');
  });

  it('renders the cause verbatim', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByTestId('api-error-cause')).toHaveTextContent(
      "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found",
    );
  });

  it('renders the stage chain', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByTestId('api-error-stage')).toHaveTextContent(
      'fastapi-sbert/caption_agent -> spring/content/generate',
    );
  });

  it('offers no retry for an unavailable dependency', () => {
    render(<ApiErrorPanel error={unavailable} onRetry={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('says the data is absent rather than simulated', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing below is simulated/i);
  });

  it('omits the cause and stage rows when the backend did not send them', () => {
    const plain = new ApiError({
      status: 500,
      method: 'GET',
      path: '/api/notifications',
      body: { code: 'MOD22_UNEXPECTED', message: 'boom' },
    });

    render(<ApiErrorPanel error={plain} />);

    expect(screen.queryByTestId('api-error-cause')).not.toBeInTheDocument();
    expect(screen.queryByTestId('api-error-stage')).not.toBeInTheDocument();
  });

  it('falls back to a generic heading when no dependency is named', () => {
    const noDep = new ApiError({
      status: 503, method: 'GET', path: '/api/x',
      body: { code: 'DEPENDENCY_NOT_CONFIGURED', message: 'y', dependency: '' },
    });

    render(<ApiErrorPanel error={noDep} />);

    expect(screen.getByRole('alert')).not.toHaveTextContent('is unavailable');
  });
});
