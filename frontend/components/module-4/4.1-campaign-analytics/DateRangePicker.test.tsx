import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DateRangePicker from './DateRangePicker';

const VALUE = { periodStart: '2026-09-14', periodEnd: '2026-09-20' };

function open(onChange = vi.fn()) {
  render(<DateRangePicker value={VALUE} onChange={onChange} maxDate="2026-09-21" />);
  fireEvent.click(screen.getByRole('button', { name: /reporting period/i }));
  return onChange;
}

describe('DateRangePicker', () => {
  it('shows the current range on the trigger', () => {
    render(<DateRangePicker value={VALUE} onChange={vi.fn()} maxDate="2026-09-21" />);
    expect(screen.getByRole('button', { name: /reporting period/i })).toHaveTextContent(
      'Sep 14 – Sep 20, 2026',
    );
  });

  it('opens a calendar on the month of the current range', () => {
    open();
    expect(screen.getByRole('dialog', { name: /choose reporting period/i })).toBeInTheDocument();
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('picks a range with two clicks, in either order, then closes', () => {
    const onChange = open();
    fireEvent.click(screen.getByRole('button', { name: 'September 13, 2026' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'September 10, 2026' }));

    expect(onChange).toHaveBeenCalledWith({ periodStart: '2026-09-10', periodEnd: '2026-09-13' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('navigates to earlier months', () => {
    const onChange = open();
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'August 3, 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'August 9, 2026' }));
    expect(onChange).toHaveBeenCalledWith({ periodStart: '2026-08-03', periodEnd: '2026-08-09' });
  });

  it('disables days after the max date and the next-month button', () => {
    open();
    expect(screen.getByRole('button', { name: 'September 22, 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next month/i })).toBeDisabled();
  });

  it('applies a preset in one click', () => {
    const onChange = open();
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
    expect(onChange).toHaveBeenCalledWith({ periodStart: '2026-08-23', periodEnd: '2026-09-21' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape without changing the range', () => {
    const onChange = open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
