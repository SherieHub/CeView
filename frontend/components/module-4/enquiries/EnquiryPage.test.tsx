import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EnquiryPage from './EnquiryPage';
import { attributionEnquiries } from '../../../services/attributionEnquiries';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/attributionEnquiries', () => ({
  attributionEnquiries: { context: vi.fn(), submit: vi.fn() },
}));
const clickId = '550e8400-e29b-41d4-a716-446655440000';
const apiError = (status: number) => new ApiError({ status, method: 'GET', path: '/api/public/attribution/enquiries' });
function open(query = `?cv=${clickId}`) {
  return render(<MemoryRouter initialEntries={[`/enquiry${query}`]}><EnquiryPage /></MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(attributionEnquiries.context).mockResolvedValue({ businessName: 'Coastal Stay' });
  vi.mocked(attributionEnquiries.submit).mockResolvedValue({ received: true });
});

describe('public enquiry form', () => {
  it.each(['', '?cv=broken'])('shows expired state for %s without a request', (query) => {
    open(query);
    expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    expect(attributionEnquiries.context).not.toHaveBeenCalled();
  });

  it('shows only the business name from context, without app chrome or login', async () => {
    vi.mocked(attributionEnquiries.context).mockResolvedValue({ businessName: 'Coastal Stay', secret: 'private-operator@example.com' } as { businessName: string });
    open();
    expect(await screen.findByRole('heading', { name: 'Enquire with Coastal Stay' })).toBeInTheDocument();
    expect(screen.queryByText('private-operator@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });

  it('blocks missing and whitespace-only required fields', async () => {
    open();
    const form = await screen.findByRole('form');
    fireEvent.submit(form);
    expect(attributionEnquiries.submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Your name (required)'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/Email, phone/), { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter your name and contact details.');
    expect(attributionEnquiries.submit).not.toHaveBeenCalled();
  });

  it('submits traveller fields and shows confirmation', async () => {
    const user = userEvent.setup();
    open();
    await user.type(await screen.findByLabelText('Your name (required)'), 'Alex');
    await user.type(screen.getByLabelText(/Email, phone/), 'alex@example.com');
    await user.type(screen.getByLabelText(/Number of guests/), '2');
    await user.type(screen.getByLabelText('Message (optional)'), 'Is a room available?');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your enquiry has been sent');
    expect(attributionEnquiries.submit).toHaveBeenCalledWith(expect.objectContaining({
      clickId, contactName: 'Alex', contactValue: 'alex@example.com', partySize: 2, message: 'Is a room available?',
    }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('blocks reversed travel dates', async () => {
    open();
    await screen.findByRole('form');
    fireEvent.change(screen.getByLabelText('Your name (required)'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/Email, phone/), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Start date (optional)'), { target: { value: '2026-10-15' } });
    fireEvent.change(screen.getByLabelText('End date (optional)'), { target: { value: '2026-10-14' } });
    fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('end date');
    expect(attributionEnquiries.submit).not.toHaveBeenCalled();
  });

  it('does not submit twice while waiting, and hides backend errors', async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(attributionEnquiries.submit).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    open();
    const form = await screen.findByRole('form');
    fireEvent.change(screen.getByLabelText('Your name (required)'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/Email, phone/), { target: { value: 'alex@example.com' } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(attributionEnquiries.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sending enquiry...' })).toBeDisabled();
    reject(new Error('Internal database error'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We could not send your enquiry.'));
    expect(screen.queryByText('Internal database error')).not.toBeInTheDocument();
  });

  it('uses the expired state only when the server says the click is unknown or used (400)', async () => {
    vi.mocked(attributionEnquiries.context).mockRejectedValue(apiError(400));
    open();
    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it.each([
    ['a 502 from a cold-starting server', apiError(502)],
    ['a 500', apiError(500)],
    ['a network failure', new TypeError('Failed to fetch')],
  ])('does not call a valid link expired after %s, and offers a retry that loads the form', async (_label, failure) => {
    vi.mocked(attributionEnquiries.context).mockRejectedValueOnce(failure);
    const user = userEvent.setup();
    open();
    expect(await screen.findByRole('heading', { name: /trouble loading this form/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This link has expired' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Enquire with Coastal Stay' })).toBeInTheDocument();
    expect(attributionEnquiries.context).toHaveBeenCalledTimes(2);
  });

  it('tells the traveller an already-sent or invalid enquiry cannot be sent again (400 on submit)', async () => {
    vi.mocked(attributionEnquiries.submit).mockRejectedValue(apiError(400));
    open();
    await screen.findByRole('form');
    fireEvent.change(screen.getByLabelText('Your name (required)'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/Email, phone/), { target: { value: 'alex@example.com' } });
    fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('already sent or the link is no longer valid');
  });

  it('keeps what the traveller typed when the server is unavailable on submit', async () => {
    vi.mocked(attributionEnquiries.submit).mockRejectedValue(apiError(503));
    open();
    await screen.findByRole('form');
    fireEvent.change(screen.getByLabelText('Your name (required)'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/Email, phone/), { target: { value: 'alex@example.com' } });
    fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not send your enquiry.');
    expect(screen.getByLabelText('Your name (required)')).toHaveValue('Alex');
    expect(screen.getByRole('button', { name: 'Send enquiry' })).toBeEnabled();
  });
});
