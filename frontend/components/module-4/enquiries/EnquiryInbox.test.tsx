import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnquiryInbox from './EnquiryInbox';
import { attributionEnquiries } from '../../../services/attributionEnquiries';

vi.mock('../../../services/attributionEnquiries', () => ({ attributionEnquiries: { list: vi.fn(), setOutcome: vi.fn() } }));
beforeEach(() => { vi.resetAllMocks(); });

type Row = Awaited<ReturnType<typeof attributionEnquiries.list>>[number];
const row = (overrides: Partial<Row> = {}): Row => ({
  enquiryId: 'one', contactName: 'Alex', contactValue: 'alex@example.com', partySize: null,
  requestedStart: null, requestedEnd: null, message: null, createdAt: '2026-09-25T08:00:00Z',
  outcome: 'NEW', bookings: 1, revenue: 0, clickInWindow: true, ...overrides,
});

it('shows contact details directly on each enquiry card', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([{
    enquiryId: 'one', contactName: 'Alex', contactValue: 'alex@example.com', partySize: 2,
    requestedStart: '2026-10-15', requestedEnd: null, message: 'Room availability?', createdAt: '2026-09-25T08:00:00Z',
    outcome: 'NEW', bookings: 1, revenue: 0, clickInWindow: true,
  }]);
  render(<EnquiryInbox />);
  await screen.findByRole('heading', { name: 'Alex' });
  expect(screen.getByText('alex@example.com')).toBeVisible();
  expect(screen.getByText('Room availability?')).toBeVisible();
});

it('shows six newest enquiries per page and searches across all pages', async () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    enquiryId: String(index), contactName: `Traveller ${index}`, contactValue: `guest${index}@example.com`,
    partySize: null, requestedStart: null, requestedEnd: null, message: null,
    createdAt: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(),
    outcome: 'NEW' as const, bookings: 1, revenue: 0, clickInWindow: true,
  }));
  vi.mocked(attributionEnquiries.list).mockResolvedValue(rows);
  const user = userEvent.setup();
  render(<EnquiryInbox />);
  await screen.findByText('Traveller 11');
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.queryByText('Traveller 0')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getByText('Traveller 0')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  await user.type(screen.getByRole('searchbox', { name: 'Search enquiries' }), ' GUEST11@EXAMPLE.COM ');
  expect(screen.getByText('Traveller 11')).toBeVisible();
  expect(screen.getByText('Page 1 of 1')).toBeVisible();
  await user.clear(screen.getByRole('searchbox'));
  await user.type(screen.getByRole('searchbox'), 'nobody');
  expect(screen.getByText('No enquiries match your search.')).toBeVisible();
  expect(screen.queryByRole('navigation', { name: 'Enquiry pages' })).not.toBeInTheDocument();
});

it('shows an error instead of a false empty inbox, then supports retry', async () => {
  vi.mocked(attributionEnquiries.list).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]);
  render(<EnquiryInbox />);
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be refreshed');
  expect(screen.queryByText('No traveller enquiries yet.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry enquiries' }));
  expect(await screen.findByText('No traveller enquiries yet.')).toBeInTheDocument();
});

it('discards the old tenant response after the profile key changes', async () => {
  let resolve!: (rows: Awaited<ReturnType<typeof attributionEnquiries.list>>) => void;
  vi.mocked(attributionEnquiries.list).mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue([]);
  const view = render(<EnquiryInbox key="tenant-one" />);
  view.rerender(<EnquiryInbox key="tenant-two" />);
  resolve([{ enquiryId: 'old', contactName: 'Private traveller', contactValue: 'private@example.com',
    partySize: null, requestedStart: null, requestedEnd: null, message: null, createdAt: '2026-09-25T08:00:00Z',
    outcome: 'NEW', bookings: 1, revenue: 0, clickInWindow: true }]);
  expect(await screen.findByText('No traveller enquiries yet.')).toBeInTheDocument();
  expect(screen.queryByText('Private traveller')).not.toBeInTheDocument();
});

it('labels each enquiry with what the operator decided and flags leads from after the campaign window', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([
    row({ enquiryId: 'a', contactName: 'Newbie', createdAt: '2026-09-25T08:00:00Z' }),
    row({ enquiryId: 'b', contactName: 'Booker', outcome: 'BOOKED', bookings: 2, revenue: 1500, createdAt: '2026-09-24T08:00:00Z' }),
    row({ enquiryId: 'c', contactName: 'Decliner', outcome: 'DECLINED', bookings: 0, createdAt: '2026-09-23T08:00:00Z' }),
    row({ enquiryId: 'd', contactName: 'Late', clickInWindow: false, createdAt: '2026-09-22T08:00:00Z' }),
  ]);
  render(<EnquiryInbox />);
  await screen.findByRole('heading', { name: 'Newbie' });
  const card = (name: string) => within(screen.getByRole('heading', { name }).closest('li') as HTMLElement);
  expect(card('Newbie').getByText('New')).toBeVisible();
  expect(card('Booker').getByText(/Booked/)).toBeVisible();
  expect(card('Booker').getByText(/1,500/)).toBeVisible();
  expect(card('Decliner').getByText('Declined')).toBeVisible();
  expect(card('Late').getByText('After campaign window')).toBeVisible();
  expect(card('Newbie').queryByText('After campaign window')).not.toBeInTheDocument();
});

it('marks an enquiry booked with the real bookings and revenue', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([row()]);
  vi.mocked(attributionEnquiries.setOutcome).mockResolvedValue(row({ outcome: 'BOOKED', bookings: 2, revenue: 2500 }));
  const user = userEvent.setup();
  render(<EnquiryInbox />);
  await screen.findByRole('heading', { name: 'Alex' });

  await user.click(screen.getByRole('button', { name: 'Mark booked' }));
  await user.clear(screen.getByLabelText('Bookings'));
  await user.type(screen.getByLabelText('Bookings'), '2');
  await user.type(screen.getByLabelText(/Revenue/), '2500');
  await user.click(screen.getByRole('button', { name: 'Save booking' }));

  expect(attributionEnquiries.setOutcome).toHaveBeenCalledWith('one', { outcome: 'BOOKED', bookings: 2, revenue: 2500 });
  expect(await screen.findByText(/Booked/)).toBeVisible();
  expect(screen.getByText(/2,500/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save booking' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit booking' })).toBeVisible();
});

it('rejects impossible figures before calling the server', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([row()]);
  const user = userEvent.setup();
  render(<EnquiryInbox />);
  await screen.findByRole('heading', { name: 'Alex' });
  await user.click(screen.getByRole('button', { name: 'Mark booked' }));

  await user.type(screen.getByLabelText(/Revenue/), '-5');
  await user.click(screen.getByRole('button', { name: 'Save booking' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/revenue/i);

  await user.clear(screen.getByLabelText(/Revenue/));
  await user.clear(screen.getByLabelText('Bookings'));
  await user.type(screen.getByLabelText('Bookings'), '0');
  await user.click(screen.getByRole('button', { name: 'Save booking' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/bookings/i);

  expect(attributionEnquiries.setOutcome).not.toHaveBeenCalled();
});

it('declines only after the operator confirms, and lets them back out', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([row()]);
  vi.mocked(attributionEnquiries.setOutcome).mockResolvedValue(row({ outcome: 'DECLINED', bookings: 0 }));
  const user = userEvent.setup();
  render(<EnquiryInbox />);
  await screen.findByRole('heading', { name: 'Alex' });

  await user.click(screen.getByRole('button', { name: 'Decline' }));
  expect(screen.getByText(/stop counting as a booking/i)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Keep enquiry' }));
  expect(attributionEnquiries.setOutcome).not.toHaveBeenCalled();
  expect(screen.queryByText(/stop counting as a booking/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Decline' }));
  await user.click(screen.getByRole('button', { name: 'Yes, decline' }));
  expect(attributionEnquiries.setOutcome).toHaveBeenCalledWith('one', { outcome: 'DECLINED' });
  expect(await screen.findByText('Declined')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark booked' })).toBeVisible();
});

it('keeps the enquiry as it was and says so when saving the outcome fails', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([row()]);
  vi.mocked(attributionEnquiries.setOutcome).mockRejectedValue(new Error('Offline'));
  const user = userEvent.setup();
  render(<EnquiryInbox />);
  await screen.findByRole('heading', { name: 'Alex' });

  await user.click(screen.getByRole('button', { name: 'Decline' }));
  await user.click(screen.getByRole('button', { name: 'Yes, decline' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
  expect(screen.queryByText('Declined')).not.toBeInTheDocument();
  expect(screen.getByText('New')).toBeVisible();
});
