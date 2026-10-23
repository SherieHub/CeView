import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage, TermsPage } from './LegalPage';
import { PRIVACY, TERMS } from '../../content/legal';

function renderAt(page: ReactElement) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe('LegalPage', () => {
  it('renders the Privacy Notice with its summary, every section and the provider table', () => {
    renderAt(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Notice' })).toBeInTheDocument();
    expect(screen.getByText(`Effective ${PRIVACY.effective}`)).toBeInTheDocument();
    for (const s of PRIVACY.sections) {
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(s.title) })).toBeInTheDocument();
    }
    const providers = screen.getByRole('table', { name: 'Service providers' });
    for (const name of ['Amazon Web Services (AWS)', 'Groq', 'Hugging Face', 'Resend', 'Meta and TikTok']) {
      expect(within(providers).getByText(name)).toBeInTheDocument();
    }
  });

  it('lists every section in "On this page", linked to its anchor', () => {
    renderAt(<TermsPage />);
    const toc = screen.getByRole('complementary', { name: 'On this page' });
    const links = within(toc).getAllByRole('link');
    expect(links).toHaveLength(TERMS.sections.length);
    expect(links[0]).toHaveAttribute('href', `#${TERMS.sections[0].id}`);
  });

  it('links between the two documents and turns inline markup into links and bold text', () => {
    renderAt(<TermsPage />);
    expect(screen.getByRole('link', { name: /Read our Privacy Notice/ })).toHaveAttribute('href', '/privacy');
    // "Our [Privacy Notice](/privacy) explains…" in the Agreement section.
    const agreement = screen.getByRole('region', { name: /Agreement/ });
    expect(within(agreement).getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('href', '/privacy');
    expect(within(agreement).getByText('Team A.I.Con', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('marks the current document in the switcher', () => {
    renderAt(<PrivacyPage />);
    const nav = screen.getByRole('navigation', { name: 'Legal documents' });
    expect(within(nav).getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Terms of Use' })).not.toHaveAttribute('aria-current');
  });
});
