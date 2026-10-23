import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { attributionEnquiries } from '../../../services/attributionEnquiries';
import type { OperatorEnquiry } from '../../../services/attributionEnquiries';

const PAGE_SIZE = 6;
const SAVE_FAILED = 'We could not save this change. Please try again.';
const peso = (amount: number) => `\u20B1${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const fieldClass = 'min-w-0 w-full rounded-sm border border-gray-light bg-white px-3 py-2 font-normal focus:outline-2 focus:outline-navy-primary';

function OutcomeBadge({ enquiry }: { enquiry: OperatorEnquiry }) {
  if (enquiry.outcome === 'BOOKED') {
    const count = `${enquiry.bookings} booking${enquiry.bookings === 1 ? '' : 's'}`;
    return <span className="rounded-full bg-mint-pale px-2 py-0.5 text-xs font-semibold text-text-heading">Booked · {count} · {peso(enquiry.revenue)}</span>;
  }
  if (enquiry.outcome === 'DECLINED') {
    return <span className="rounded-full bg-gray-light px-2 py-0.5 text-xs font-semibold text-text-heading">Declined</span>;
  }
  return <span className="rounded-full border border-gray-light px-2 py-0.5 text-xs font-semibold text-text-heading">New</span>;
}

/** One traveller enquiry, with the operator's decision on it: booked (with real figures) or declined. */
function EnquiryCard({ enquiry, onUpdated }: { enquiry: OperatorEnquiry; onUpdated(updated: OperatorEnquiry): void }) {
  const ids = useId();
  const [mode, setMode] = useState<'idle' | 'book' | 'decline'>('idle');
  const [bookings, setBookings] = useState(String(Math.max(enquiry.bookings, 1)));
  const [revenue, setRevenue] = useState(enquiry.revenue > 0 ? String(enquiry.revenue) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function open(next: 'book' | 'decline') {
    setError('');
    if (next === 'book') {
      setBookings(String(Math.max(enquiry.bookings, 1)));
      setRevenue(enquiry.revenue > 0 ? String(enquiry.revenue) : '');
    }
    setMode(next);
  }

  async function save(input: Parameters<typeof attributionEnquiries.setOutcome>[1]) {
    setPending(true);
    setError('');
    try {
      onUpdated(await attributionEnquiries.setOutcome(enquiry.enquiryId, input));
      setMode('idle');
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setPending(false);
    }
  }

  function saveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const count = Number(bookings);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      setError('Bookings must be a whole number from 1 to 500.');
      return;
    }
    const amount = revenue.trim() === '' ? undefined : Number(revenue);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError('Revenue must be 0 or more.');
      return;
    }
    void save({ outcome: 'BOOKED', bookings: count, ...(amount !== undefined ? { revenue: amount } : {}) });
  }

  return (
    <li className="min-w-0 rounded-md border border-gray-light bg-white p-4 wrap-anywhere">
      <h3 className="font-semibold text-text-heading">{enquiry.contactName}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <OutcomeBadge enquiry={enquiry} />
        {!enquiry.clickInWindow && (
          <span className="rounded-full border border-gray-light px-2 py-0.5 text-xs text-text-body">After campaign window</span>
        )}
      </div>
      <time className="mt-1 block text-xs text-text-body" dateTime={enquiry.createdAt}>{new Date(enquiry.createdAt).toLocaleString()}</time>
      <dl className="mt-3 grid gap-2 border-t border-gray-light pt-3 text-sm">
        <div><dt className="inline font-semibold text-text-heading">Contact:</dt>{' '}<dd className="inline">{enquiry.contactValue}</dd></div>
        {enquiry.partySize != null && <div><dt className="inline font-semibold text-text-heading">Guests:</dt>{' '}<dd className="inline">{enquiry.partySize}</dd></div>}
        {enquiry.requestedStart && <div><dt className="inline font-semibold text-text-heading">Start date:</dt>{' '}<dd className="inline">{enquiry.requestedStart}</dd></div>}
        {enquiry.requestedEnd && <div><dt className="inline font-semibold text-text-heading">End date:</dt>{' '}<dd className="inline">{enquiry.requestedEnd}</dd></div>}
        {enquiry.message && <div><dt className="inline font-semibold text-text-heading">Message:</dt>{' '}<dd className="inline whitespace-pre-wrap">{enquiry.message}</dd></div>}
      </dl>

      {mode === 'idle' && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-light pt-3">
          <button type="button" className="btn-outline" onClick={() => open('book')}>
            {enquiry.outcome === 'BOOKED' ? 'Edit booking' : 'Mark booked'}
          </button>
          {enquiry.outcome !== 'DECLINED' && (
            <button type="button" className="btn-outline" onClick={() => open('decline')}>Decline</button>
          )}
        </div>
      )}

      {mode === 'book' && (
        <form onSubmit={saveBooking} noValidate className="mt-3 grid gap-3 border-t border-gray-light pt-3 text-sm">
          <label htmlFor={`${ids}-bookings`} className="grid gap-1 font-semibold text-text-heading">
            Bookings
            <input id={`${ids}-bookings`} className={fieldClass} type="number" inputMode="numeric" min={1} max={500} step={1}
              value={bookings} onChange={(event) => setBookings(event.target.value)} />
          </label>
          <label htmlFor={`${ids}-revenue`} className="grid gap-1 font-semibold text-text-heading">
            Revenue (₱, optional)
            <input id={`${ids}-revenue`} className={fieldClass} type="number" inputMode="decimal" min={0} step="0.01"
              value={revenue} onChange={(event) => setRevenue(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary btn-primary--sm" disabled={pending}>{pending ? 'Saving...' : 'Save booking'}</button>
            <button type="button" className="btn-outline" disabled={pending} onClick={() => setMode('idle')}>Cancel</button>
          </div>
        </form>
      )}

      {mode === 'decline' && (
        <div className="mt-3 grid gap-3 border-t border-gray-light pt-3 text-sm">
          <p>Decline this enquiry? It will stop counting as a booking in your campaign evidence.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-primary--sm" disabled={pending} onClick={() => void save({ outcome: 'DECLINED' })}>
              {pending ? 'Saving...' : 'Yes, decline'}
            </button>
            <button type="button" className="btn-outline" disabled={pending} onClick={() => setMode('idle')}>Keep enquiry</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-critical-text">{error}</p>}
    </li>
  );
}

/** Mounted with the profile id as its key so switching tenants discards all contact details. */
export default function EnquiryInbox() {
  const [enquiries, setEnquiries] = useState<OperatorEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const replaceEnquiry = (updated: OperatorEnquiry) =>
    setEnquiries((current) => current.map((row) => (row.enquiryId === updated.enquiryId ? updated : row)));

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const rows = await attributionEnquiries.list(controller.signal);
        if (!controller.signal.aborted) {
          setEnquiries([...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(load, 60_000);
        }
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [retry]);

  const query = search.trim().toLowerCase();
  const filtered = enquiries.filter((enquiry) =>
    enquiry.contactName.toLowerCase().includes(query) || enquiry.contactValue.toLowerCase().includes(query));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <section className="card mb-6" aria-label="Traveller enquiries" aria-busy={loading}>
      <h2 className="heading-md">Traveller enquiries</h2>
      <p className="mt-2 text-sm">Requests from your ads. Contact each traveller, then mark the enquiry booked (with what it was worth) or declined so your campaign results stay accurate.</p>
      <label className="mt-4 grid max-w-sm gap-2 text-sm font-semibold text-text-heading">
        Search enquiries
        <input
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Name or contact details"
          className="min-w-0 w-full rounded-sm border border-gray-light bg-white px-3 py-2 font-normal focus:outline-2 focus:outline-navy-primary"
        />
      </label>
      {loading && <p role="status" className="mt-3">Loading enquiries...</p>}
      {failed && (
        <div role="alert" className="mt-3">
          <p>Enquiries could not be refreshed. Any details below may be out of date.</p>
          <button type="button" className="btn-outline mt-2" onClick={() => setRetry((value) => value + 1)}>Retry enquiries</button>
        </div>
      )}
      {!loading && !failed && enquiries.length === 0 && <p className="mt-3">No traveller enquiries yet.</p>}
      {!loading && enquiries.length > 0 && filtered.length === 0 && <p role="status" className="mt-3">No enquiries match your search.</p>}
      <ul className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((enquiry) => (
          <EnquiryCard key={enquiry.enquiryId} enquiry={enquiry} onUpdated={replaceEnquiry} />
        ))}
      </ul>
      {filtered.length > 0 && (
        <nav aria-label="Enquiry pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-light pt-4 text-sm">
          <p role="status">Showing {start + 1}-{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} enquiries</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-outline disabled:cursor-not-allowed disabled:opacity-50" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button type="button" className="btn-outline disabled:cursor-not-allowed disabled:opacity-50" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </nav>
      )}
    </section>
  );
}
