import { useEffect, useState } from 'react';
import { attributionEnquiries } from '../../../services/attributionEnquiries';
import type { OperatorEnquiry } from '../../../services/attributionEnquiries';

const PAGE_SIZE = 6;

/** Mounted with the profile id as its key so switching tenants discards all contact details. */
export default function EnquiryInbox() {
  const [enquiries, setEnquiries] = useState<OperatorEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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
      <p className="mt-2 text-sm">Requests from your ads. Contact each traveller to confirm availability and booking details.</p>
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
          <li key={enquiry.enquiryId} className="min-w-0 rounded-md border border-gray-light bg-white p-4 wrap-anywhere">
              <h3 className="font-semibold text-text-heading">{enquiry.contactName}</h3>
              <time className="mt-1 block text-xs text-text-body" dateTime={enquiry.createdAt}>{new Date(enquiry.createdAt).toLocaleString()}</time>
              <dl className="mt-3 grid gap-2 border-t border-gray-light pt-3 text-sm">
                <div><dt className="inline font-semibold text-text-heading">Contact:</dt>{' '}<dd className="inline">{enquiry.contactValue}</dd></div>
                {enquiry.partySize != null && <div><dt className="inline font-semibold text-text-heading">Guests:</dt>{' '}<dd className="inline">{enquiry.partySize}</dd></div>}
                {enquiry.requestedStart && <div><dt className="inline font-semibold text-text-heading">Start date:</dt>{' '}<dd className="inline">{enquiry.requestedStart}</dd></div>}
                {enquiry.requestedEnd && <div><dt className="inline font-semibold text-text-heading">End date:</dt>{' '}<dd className="inline">{enquiry.requestedEnd}</dd></div>}
                {enquiry.message && <div><dt className="inline font-semibold text-text-heading">Message:</dt>{' '}<dd className="inline whitespace-pre-wrap">{enquiry.message}</dd></div>}
              </dl>
          </li>
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
