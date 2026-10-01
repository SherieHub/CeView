import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LandingPage from '../LandingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('has exactly one h1 and never renders a bracketed placeholder', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/\[[A-Z][A-Z /_-]{3,}\]/);
  });

  it('offers the in-page product tour when no walkthrough video is configured', () => {
    renderPage();
    const tourLinks = screen.getAllByRole('link', { name: /Take the Product Tour/ });
    expect(tourLinks.length).toBeGreaterThan(0);
    tourLinks.forEach((a) => expect(a).toHaveAttribute('href', '#product'));
    expect(screen.queryByRole('link', { name: /Watch Product Walkthrough/ })).not.toBeInTheDocument();
  });

  it('points every "Request a Demo" link at the demo form', () => {
    renderPage();
    for (const link of screen.getAllByRole('link', { name: /Request a Demo/ })) {
      expect(link).toHaveAttribute('href', '#request-demo');
    }
    expect(document.getElementById('request-demo')).not.toBeNull();
  });

  it('hides footer legal and contact links until they are configured', () => {
    renderPage();
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contact' })).not.toBeInTheDocument();
  });

  it('switches the product tour with the arrow keys and exposes one panel at a time', () => {
    renderPage();
    const first = screen.getByRole('tab', { name: /Demand Intelligence/ });
    expect(first).toHaveAttribute('aria-selected', 'true');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    const second = screen.getByRole('tab', { name: /Content Studio/ });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveFocus();
    const exposed = document.querySelectorAll('[role="tabpanel"]:not([aria-hidden="true"])');
    expect(exposed).toHaveLength(1);
    expect(exposed[0]).toHaveAttribute('aria-labelledby', second.id);
  });

  it('keeps one FAQ answer open at a time', () => {
    renderPage();
    const q = screen.getByRole('button', { name: 'Does CeView automatically publish my content?' });
    fireEvent.click(q);
    expect(q).toHaveAttribute('aria-expanded', 'true');
    const expanded = screen.getAllByRole('button', { expanded: true });
    expect(expanded).toHaveLength(1);
    expect(screen.getByText(/doesn’t post to your social media accounts on its own/)).toBeInTheDocument();
  });

  describe('demo form', () => {
    const form = () => screen.getByRole('form', { name: 'Request your demo' });

    it('flags each missing required field and focuses the first one', () => {
      renderPage();
      fireEvent.click(within(form()).getByRole('button', { name: /Request My Demo/ }));
      expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Full name')).toHaveFocus();
      expect(screen.getByText('Please enter your work email.')).toBeInTheDocument();
      expect(screen.getByText('Please enter your business name.')).toBeInTheDocument();
      expect(screen.getByText('Please choose the closest type of business.')).toBeInTheDocument();
    });

    it('rejects a malformed email', () => {
      renderPage();
      fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'not-an-email' } });
      fireEvent.click(within(form()).getByRole('button', { name: /Request My Demo/ }));
      expect(screen.getByText(/valid email address/)).toBeInTheDocument();
    });

    it('never claims a request was sent when no destination is configured', () => {
      renderPage();
      fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ana Cruz' } });
      fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ana@resort.ph' } });
      fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Sunset Cove' } });
      fireEvent.change(screen.getByLabelText('Type of tourism business'), { target: { value: 'Coastal & Island' } });
      fireEvent.click(within(form()).getByRole('button', { name: /Request My Demo/ }));
      expect(screen.getByText(/aren’t open just yet, so nothing was sent/)).toBeInTheDocument();
      expect(screen.queryByText(/your request is in/)).not.toBeInTheDocument();
    });
  });
});
