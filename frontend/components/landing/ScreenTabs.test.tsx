import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScreenTabs from './ScreenTabs';
import { SCREENS } from '../../content/landing';

function renderTabs() {
  return render(
    <MemoryRouter>
      <ScreenTabs />
    </MemoryRouter>,
  );
}

const activePanel = () => document.querySelector('.cv-screens-panel[data-active]') as HTMLElement;

describe('ScreenTabs — guided showcase', () => {
  it('opens each tool on an overview with every numbered point', () => {
    renderTabs();
    const panel = activePanel();
    expect(within(panel).getByText('Overview')).toBeInTheDocument();
    expect(within(panel).getAllByRole('button', { name: /^Point \d/ })).toHaveLength(SCREENS.tabs[0].steps.length);
  });

  it('Next walks through the steps, showing only the current point', () => {
    renderTabs();
    const panel = activePanel();
    fireEvent.click(within(panel).getByRole('button', { name: 'Next' }));
    expect(within(panel).getByText(`Step 1 of ${SCREENS.tabs[0].steps.length}`)).toBeInTheDocument();
    expect(within(panel).getByText(SCREENS.tabs[0].steps[0].title)).toBeInTheDocument();
    const points = within(panel).getAllByRole('button', { name: /^Point \d/ });
    expect(points).toHaveLength(1);
    expect(points[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('a point or a dot jumps straight to its step, and Back returns to the overview', () => {
    renderTabs();
    const panel = activePanel();
    fireEvent.click(within(panel).getByRole('button', { name: /^Point 2/ }));
    expect(within(panel).getByText(SCREENS.tabs[0].steps[1].title)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Show step 3' }));
    expect(within(panel).getByText(SCREENS.tabs[0].steps[2].title)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Show the whole screen' }));
    expect(within(panel).getByText('Overview')).toBeInTheDocument();
  });

  it('after the last step, Next moves on to the next tool', () => {
    renderTabs();
    const panel = activePanel();
    fireEvent.click(within(panel).getByRole('button', { name: `Show step ${SCREENS.tabs[0].steps.length}` }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Next tool' }));
    expect(screen.getByRole('tab', { name: SCREENS.tabs[1].label })).toHaveAttribute('aria-selected', 'true');
    expect(within(activePanel()).getByText('Overview')).toBeInTheDocument();
  });

  it('loads a screenshot only once its tool has been shown', () => {
    renderTabs();
    expect(document.querySelectorAll('.cv-shot img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: SCREENS.tabs[2].label }));
    expect(document.querySelectorAll('.cv-shot img')).toHaveLength(2);
  });

  it('offers the interactive demo and keeps Request a Demo on the form', () => {
    renderTabs();
    expect(screen.getByRole('link', { name: /Try Interactive Demo/ })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: 'Request a Demo' })).toHaveAttribute('href', '#demo');
  });
});
