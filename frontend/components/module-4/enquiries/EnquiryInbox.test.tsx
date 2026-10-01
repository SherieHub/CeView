import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnquiryInbox from './EnquiryInbox';
import { attributionEnquiries } from '../../../services/attributionEnquiries';

vi.mock('../../../services/attributionEnquiries', () => ({ attributionEnquiries: { list: vi.fn() } }));
beforeEach(() => { vi.resetAllMocks(); });

it('shows contact details directly on each enquiry card', async () => {
  vi.mocked(attributionEnquiries.list).mockResolvedValue([{
    enquiryId: 'one', contactName: 'Alex', contactValue: 'alex@example.com', partySize: 2,
    requestedStart: '2026-10-15', requestedEnd: null, message: 'Room availability?', createdAt: '2026-09-25T08:00:00Z',
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
    partySize: null, requestedStart: null, requestedEnd: null, message: null, createdAt: '2026-09-25T08:00:00Z' }]);
  expect(await screen.findByText('No traveller enquiries yet.')).toBeInTheDocument();
  expect(screen.queryByText('Private traveller')).not.toBeInTheDocument();
});
