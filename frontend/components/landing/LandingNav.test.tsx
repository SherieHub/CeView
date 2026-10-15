import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LandingNav from './LandingNav';

function renderNav() {
  return render(
    <MemoryRouter>
      <LandingNav />
    </MemoryRouter>,
  );
}

describe('LandingNav', () => {
  it('links every section, Sign In and the demo form from the header', () => {
    renderNav();
    const header = screen.getByRole('banner');
    const nav = within(header).getByRole('navigation', { name: 'Page sections' });
    const links = within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Why CeView', '#why'],
      ['How It Works', '#how-it-works'],
      ['Features', '#features'],
      ['Who It’s For', '#who'],
      ['Pricing', '#pricing'],
      ['FAQ', '#faq'],
    ]);
    expect(within(header).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(within(header).getByRole('link', { name: /Request a Demo/ })).toHaveAttribute('href', '#demo');
  });

  it('opens the menu sheet, locks page scroll and moves focus into it', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(sheet).getByRole('link', { name: /Request a Demo/ })).toHaveAttribute('href', '#demo');
    expect(within(sheet).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
  });

  it('closes on Escape, restores scroll and returns focus to the menu button', () => {
    renderNav();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(toggle);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps Tab focus inside the open sheet', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    const focusables = sheet.querySelectorAll<HTMLElement>('a[href], button');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('closes the sheet when a section link is chosen', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: /FAQ/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
