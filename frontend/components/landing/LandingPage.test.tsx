import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LandingPage from '../LandingPage';
import { IMAGE_CREDITS } from '../../content/image-credits';

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
      expect(link).toHaveAttribute('href', '#demo');
    }
    expect(document.getElementById('demo')).not.toBeNull();
  });

  it('hides footer legal and contact links until they are configured', () => {
    renderPage();
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contact' })).not.toBeInTheDocument();
  });

  it('switches the screen tabs with the arrow keys and exposes one panel at a time', () => {
    renderPage();
    const first = screen.getByRole('tab', { name: /Market radar/ });
    expect(first).toHaveAttribute('aria-selected', 'true');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    const second = screen.getByRole('tab', { name: /Content studio/ });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveFocus();
    const exposed = document.querySelectorAll('[role="tabpanel"]:not([aria-hidden="true"])');
    expect(exposed).toHaveLength(1);
    expect(exposed[0]).toHaveAttribute('aria-labelledby', second.id);
  });

  it('wraps the screen tabs with Home/End and the arrow keys', () => {
    renderPage();
    const first = screen.getByRole('tab', { name: /Market radar/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    const last = screen.getByRole('tab', { name: /Performance/ });
    expect(last).toHaveAttribute('aria-selected', 'true');
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Home' });
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('shows all eight features, the seven themes exactly, and Meta/TikTok as text only', () => {
    renderPage();
    const features = document.getElementById('features') as HTMLElement;
    expect(features.querySelectorAll('article.cv-feat')).toHaveLength(8);
    const themes = [...features.querySelectorAll('.cv-feat-themes li')].map((li) => li.firstChild?.textContent);
    expect(themes).toEqual([
      'Coastal & Island',
      'Adventure & Nature',
      'Cultural & Heritage',
      'Theme Parks & Entertainment',
      'Urban & City',
      'Culinary & Gastronomy',
      'Accommodation & Staycation',
    ]);
    expect(within(features).getByText('Meta')).toBeInTheDocument();
    expect(within(features).getByText('TikTok')).toBeInTheDocument();
    expect(features.querySelector('img')).toBeNull();
  });

  it('shows eight business cards with photos, the theme explainer, the partner band and the not-customers note', () => {
    renderPage();
    const who = document.getElementById('who') as HTMLElement;
    const cards = who.querySelectorAll('.cv-who-card');
    expect(cards).toHaveLength(8);
    cards.forEach((c) => expect(c.querySelector('img')).not.toBeNull());
    expect(within(who).getByText(/doesn’t forecast by business type/)).toBeInTheDocument();
    expect(within(who).getByRole('link', { name: /See the Partner Plan/ })).toHaveAttribute('href', '#pricing');
    expect(within(who).getByText(/These are not CeView customers/)).toBeInTheDocument();
  });

  it('compares five options and labels the pilot numbers as targets', () => {
    renderPage();
    const compare = document.getElementById('compare') as HTMLElement;
    expect(compare.querySelectorAll('.cv-cmp-row')).toHaveLength(5);
    const trust = document.getElementById('trust') as HTMLElement;
    expect(trust.querySelectorAll('.cv-trust-card')).toHaveLength(6);
    expect(within(trust).getByText('Targets, not results yet')).toBeInTheDocument();
    expect(trust.querySelectorAll('.cv-trust-targets > div')).toHaveLength(4);
  });

  it('switches plan prices between monthly and annual billing', () => {
    renderPage();
    const pricing = document.getElementById('pricing') as HTMLElement;
    const growth = pricing.querySelector('.cv-price-card[data-featured]') as HTMLElement;
    expect(within(growth).getByText('₱999')).toBeInTheDocument();
    fireEvent.click(within(pricing).getByRole('radio', { name: 'Annually · 2 months free' }));
    expect(within(growth).getByText('₱9,990')).toBeInTheDocument();
    expect(within(growth).getByText('≈ ₱833/month')).toBeInTheDocument();
    expect(within(pricing).getByText(/All prices in PHP and proposed/)).toBeInTheDocument();
    for (const link of within(pricing).getAllByRole('link')) expect(link.getAttribute('href')).toMatch(/^#demo\?plan=/);
  });

  it('publishes the FAQ as FAQPage JSON-LD with the same questions', () => {
    renderPage();
    const ld = document.querySelector('#faq script[type="application/ld+json"]') as HTMLScriptElement;
    const data = JSON.parse(ld.textContent ?? '{}');
    expect(data['@type']).toBe('FAQPage');
    const questions = [...document.querySelectorAll('#faq .cv-faq-q button')].map((b) => b.textContent);
    expect(data.mainEntity.map((q: { name: string }) => q.name)).toEqual(questions);
    expect(questions).toHaveLength(12);
    // The first answer is open by default.
    expect(screen.getByRole('button', { name: 'What exactly does CeView do?' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists every photo credit in the footer dialog', () => {
    renderPage();
    const dialog = document.querySelector('dialog.cv-credits') as HTMLDialogElement;
    // Closed dialogs are hidden from role queries, so check the markup directly.
    expect(dialog.querySelectorAll('.cv-credits-list > li')).toHaveLength(IMAGE_CREDITS.length);
    expect(dialog.textContent).toContain('Lindstrm');
  });

  it('labels the Market Explorer as sample data and lists all five markets', () => {
    renderPage();
    const card = document.querySelector('.cv-mx') as HTMLElement;
    expect(within(card).getByText('Sample data')).toBeInTheDocument();
    const rows = within(card).getAllByRole('listitem').filter((li) => li.classList.contains('cv-mx-row'));
    expect(rows.map((r) => r.querySelector('.cv-market-name')?.textContent)).toEqual([
      'South Korea',
      'Japan',
      'Other PH regions',
      'United States',
      'Cebu & nearby',
    ]);
  });

  it('moves the active workflow phase with the arrow keys, Home/End and a tap', () => {
    renderPage();
    const rail = screen.getByRole('list', { name: 'The five phases' });
    const phases = within(rail).getAllByRole('listitem');
    expect(phases).toHaveLength(5);
    const current = () => phases.filter((p) => p.getAttribute('aria-current') === 'step');
    expect(current()).toEqual([phases[0]]);

    phases[0].focus();
    fireEvent.keyDown(phases[0], { key: 'ArrowRight' });
    expect(current()).toEqual([phases[1]]);
    expect(phases[1]).toHaveFocus();
    expect(phases[1]).toHaveAttribute('tabindex', '0');
    expect(phases[0]).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(phases[1], { key: 'End' });
    expect(current()).toEqual([phases[4]]);
    fireEvent.keyDown(phases[4], { key: 'ArrowRight' });
    expect(current()).toEqual([phases[0]]);

    fireEvent.click(phases[3]);
    expect(current()).toEqual([phases[3]]);
  });

  it('keeps one FAQ answer open at a time', () => {
    renderPage();
    const q = screen.getByRole('button', { name: 'Does CeView publish content automatically?' });
    fireEvent.click(q);
    expect(q).toHaveAttribute('aria-expanded', 'true');
    const expanded = screen.getAllByRole('button', { expanded: true });
    expect(expanded).toHaveLength(1);
    expect(screen.getByText(/Nothing is posted to your accounts on your behalf/)).toBeInTheDocument();
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
      fireEvent.change(screen.getByLabelText('Type of tourism business'), { target: { value: 'Resort, hotel or homestay' } });
      fireEvent.click(within(form()).getByRole('button', { name: /Request My Demo/ }));
      expect(screen.getByText(/aren’t open just yet, so nothing was sent/)).toBeInTheDocument();
      expect(screen.queryByText(/your request is in/)).not.toBeInTheDocument();
    });
  });
});
