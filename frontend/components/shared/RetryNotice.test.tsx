// frontend/components/shared/RetryNotice.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiError';
import { RETRY_COPY, RetryNotice } from './RetryNotice';

const unavailable = new ApiError({
  status: 503,
  method: 'POST',
  path: '/api/classification/analyze',
  body: { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' },
});
const quota = new ApiError({
  status: 503,
  method: 'POST',
  path: '/api/forecasting/analyze',
  body: { code: 'MOD22_BILSTM_UNAVAILABLE', cause: 'You have exceeded your ZeroGPU runs limit' },
});

describe('RetryNotice', () => {
  it('is an alert carrying the title and the retry copy', () => {
    render(<RetryNotice error={unavailable} title="The analysis didn't finish." onRetry={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("The analysis didn't finish.");
    expect(alert).toHaveTextContent(RETRY_COPY.retry);
  });

  it('asks the operator to wait on a quota failure', () => {
    render(<RetryNotice error={quota} title="The forecast didn't update." onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(RETRY_COPY.wait);
  });

  it('never renders the request path, status or cause', () => {
    render(<RetryNotice error={quota} title="The forecast didn't update." onRetry={vi.fn()} />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).not.toContain('/api/');
    expect(text).not.toContain('503');
    expect(text).not.toContain('ZeroGPU');
  });

  it('calls onRetry when Try again is clicked', () => {
    const onRetry = vi.fn();
    render(<RetryNotice error={unavailable} title="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables the button while busy', () => {
    render(<RetryNotice error={unavailable} title="x" onRetry={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: /Trying again/ })).toBeDisabled();
  });
});
