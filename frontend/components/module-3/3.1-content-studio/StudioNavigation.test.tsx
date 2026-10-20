import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StudioNavigation from './StudioNavigation';
import type { StudioView } from './StudioNavigation';

function Harness() {
  const [view, setView] = useState<StudioView>('quick');
  return <StudioNavigation view={view} onChange={setView} counts={{ library: 4 }} />;
}

describe('StudioNavigation', () => {
  it('switches views by click and by arrow keys, keeping one tab in the tab order', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const quick = screen.getByRole('tab', { name: /Quick Post/ });
    expect(quick).toHaveAttribute('aria-selected', 'true');
    expect(quick).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /Content Library/ })).toHaveTextContent('4');

    await user.click(screen.getByRole('tab', { name: /Campaigns/ }));
    expect(screen.getByRole('tab', { name: /Campaigns/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    const library = screen.getByRole('tab', { name: /Content Library/ });
    expect(library).toHaveAttribute('aria-selected', 'true');
    expect(library).toHaveFocus();

    await user.keyboard('{Home}');
    expect(quick).toHaveAttribute('aria-selected', 'true');
  });
});
