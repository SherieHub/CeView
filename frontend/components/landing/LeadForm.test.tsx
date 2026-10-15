import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A configured endpoint, as in production (VITE_LEAD_FORM_ENDPOINT).
vi.mock('../../content/landing', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../content/landing')>();
  return { ...mod, SITE: { ...mod.SITE, leadFormEndpoint: 'https://example.test/leads' } };
});

import LeadForm from './LeadForm';

function fillValid() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ana Cruz' } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ana@resort.ph' } });
  fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Sunset Cove' } });
  fireEvent.change(screen.getByLabelText('Type of tourism business'), { target: { value: 'Resort, hotel or homestay' } });
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Request My Demo/ }));

describe('LeadForm with an endpoint configured', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.location.hash = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the same fields to the endpoint and shows the success state', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<LeadForm />);
    fillValid();
    submit();
    await screen.findByText('Thanks — we’ll be in touch soon.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/leads');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Ana Cruz',
      email: 'ana@resort.ph',
      business: 'Sunset Cove',
      businessType: 'Resort, hotel or homestay',
      help: '',
      source: 'landing-page',
    });
    expect(screen.getByRole('link', { name: 'Explore the FAQ' })).toHaveAttribute('href', '#faq');
  });

  it('sends the plan chosen on the pricing cards', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    window.location.hash = '#demo?plan=growth';
    render(<LeadForm />);
    expect(screen.getByText('Growth')).toBeInTheDocument();
    fillValid();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).plan).toBe('growth');
  });

  it('pre-selects the Partner Plan as the help topic', () => {
    window.location.hash = '#demo?plan=partner';
    render(<LeadForm />);
    expect(screen.getByLabelText(/most like help with/)).toHaveValue('The Partner Plan');
  });

  it('shows an error, not a confirmation, when the endpoint fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    render(<LeadForm />);
    fillValid();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t send your request just now.');
    expect(screen.queryByText('Thanks — we’ll be in touch soon.')).not.toBeInTheDocument();
  });

  it('flags errors inline, links them to their fields and announces the count', () => {
    render(<LeadForm />);
    submit();
    const name = screen.getByLabelText('Full name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('aria-describedby', 'lead-name-error');
    expect(document.getElementById('lead-name-error')).toHaveTextContent('Please enter your full name.');
    expect(screen.getByText('4 fields need attention.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
