/**
 * /terms and /privacy — the Terms of Use and Privacy Notice, rendered from
 * content/legal.ts so the two documents share one layout: a title band, a
 * plain-language summary, the full text with a sticky "On this page" list,
 * then contact details and a link to the other document.
 *
 * Public pages: reachable signed in or out, so they sit outside the auth
 * gates. Styles: styles/legal.css (.lg-*), on the landing page's tokens.
 */
import '@fontsource-variable/fraunces/opsz.css';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Mail, Printer, ShieldCheck, Sparkles } from 'lucide-react';
import { BrandMark } from '../landing/LandingNav';
import LandingFooter from '../landing/LandingFooter';
import { LEGAL_CONTACT, PRIVACY, TERMS } from '../../content/legal';
import type { LegalBlock, LegalDoc } from '../../content/legal';
import '../../styles/legal.css';

/** **bold** and [label](href) — the only inline markup the content uses. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = `${match.index}`;
    if (match[1]) {
      out.push(<strong key={key}>{match[1]}</strong>);
    } else if (match[3].startsWith('/')) {
      out.push(<Link key={key} to={match[3]}>{match[2]}</Link>);
    } else {
      out.push(<a key={key} href={match[3]} target="_blank" rel="noopener noreferrer">{match[2]}</a>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'p':
      return <p>{inline(block.text)}</p>;
    case 'note':
      return <p className="lg-note">{inline(block.text)}</p>;
    case 'list':
      return (
        <ul className="lg-list">
          {block.items.map((item) => <li key={item}>{inline(item)}</li>)}
        </ul>
      );
    case 'table':
      return (
        <div className="lg-table-wrap">
          <table className="lg-table">
            <caption className="sr-only">{block.caption}</caption>
            <thead>
              <tr>{block.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, i) => (
                    // data-label carries the column name for the stacked phone layout.
                    <td key={i} data-label={block.head[i]}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Highlights the section currently under the reading line. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === 'terms' ? PRIVACY : TERMS;
  const ids = doc.sections.map((s) => s.id);
  const active = useActiveSection(ids);
  const DocIcon = doc.slug === 'privacy' ? ShieldCheck : FileText;

  useEffect(() => {
    document.title = `${doc.title} — CeView`;
    window.scrollTo?.({ top: 0 });
  }, [doc]);

  return (
    <div className="lp lg">
      <header className="lg-bar">
        <div className="cv-container lg-bar-inner">
          <Link to="/" className="lg-home" aria-label="CeView home">
            <BrandMark />
          </Link>
          <nav className="lg-switch" aria-label="Legal documents">
            <Link to="/terms" aria-current={doc.slug === 'terms' ? 'page' : undefined}>Terms of Use</Link>
            <Link to="/privacy" aria-current={doc.slug === 'privacy' ? 'page' : undefined}>Privacy Notice</Link>
          </nav>
          <Link to="/" className="lg-back">
            <ArrowLeft size={16} aria-hidden="true" /> Back to CeView
          </Link>
        </div>
      </header>

      <main id="lg-main">
        <section className="lg-hero" aria-labelledby="lg-title">
          <div className="cv-container lg-hero-inner">
            <span className="lg-hero-icon" aria-hidden="true"><DocIcon size={26} /></span>
            <p className="lg-eyebrow">Legal</p>
            <h1 id="lg-title" className="lg-title">{doc.title}</h1>
            <p className="lg-lede">{doc.lede}</p>
            <div className="lg-meta">
              <span>Effective {doc.effective}</span>
              <span aria-hidden="true">·</span>
              <span>Operated by {LEGAL_CONTACT.operator}</span>
              <button type="button" className="lg-print" onClick={() => window.print()}>
                <Printer size={15} aria-hidden="true" /> Print or save as PDF
              </button>
            </div>
          </div>
        </section>

        <div className="cv-container lg-body">
          <aside className="lg-toc" aria-label="On this page">
            <p className="lg-toc-title">On this page</p>
            <ol>
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined}>
                    <span className="lg-toc-num">{i + 1}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <article className="lg-article">
            <section className="lg-summary" aria-labelledby="lg-summary-title">
              <h2 id="lg-summary-title" className="lg-summary-title">
                <Sparkles size={18} aria-hidden="true" /> At a glance
              </h2>
              <ul>
                {doc.summary.map((s) => <li key={s}>{s}</li>)}
              </ul>
              <p className="lg-summary-note">This summary is for convenience. The full text below is what applies.</p>
            </section>

            {doc.sections.map((s, i) => (
              <section key={s.id} className="lg-section" id={s.id} aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`} className="lg-h2">
                  <span className="lg-num" aria-hidden="true">{i + 1}</span>
                  {s.title}
                </h2>
                {s.blocks.map((b, j) => <Block key={j} block={b} />)}
              </section>
            ))}

            <div className="lg-end">
              <div className="lg-card">
                <span className="lg-card-icon" aria-hidden="true"><Mail size={20} /></span>
                <div>
                  <p className="lg-card-title">Questions or requests?</p>
                  <p>
                    {doc.slug === 'privacy' ? <>Our Data Protection Officer, {LEGAL_CONTACT.dpoName}, at </> : <>Email us at </>}
                    <a href={`mailto:${LEGAL_CONTACT.email}`}>{LEGAL_CONTACT.email}</a>.
                  </p>
                </div>
              </div>
              <Link to={`/${other.slug}`} className="lg-card lg-card--link">
                <span className="lg-card-icon" aria-hidden="true">
                  {other.slug === 'privacy' ? <ShieldCheck size={20} /> : <FileText size={20} />}
                </span>
                <div>
                  <p className="lg-card-title">Read our {other.title}</p>
                  <p>{other.lede}</p>
                </div>
                <ArrowRight size={18} aria-hidden="true" className="lg-card-arrow" />
              </Link>
            </div>
          </article>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

export function TermsPage() {
  return <LegalPage doc={TERMS} />;
}

export function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
