/**
 * The strip across the top of the demo: what this is (sample data, nothing
 * saved or posted), and the four things a visitor may want — the tour, a
 * reset, a real demo with the team, and the way out.
 */
import { Link } from 'react-router-dom';
import { Compass, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import { track } from '../../services/analytics';

export default function DemoBar({ touring, onTour, onReset }: {
  touring: boolean;
  onTour: () => void;
  onReset: () => void;
}) {
  return (
    <div className="dm-bar" role="region" aria-label="Interactive demo">
      <span className="dm-bar-badge">
        <Sparkles size={14} aria-hidden="true" /> Interactive demo · Sample data
      </span>
      <p className="dm-bar-note">
        Sunset Cove Beach Resort is fictional. Nothing here is saved or posted.
      </p>
      <button type="button" className="dm-bar-btn dm-bar-tour" onClick={onTour} aria-pressed={touring}>
        <Compass size={15} aria-hidden="true" />
        <span>{touring ? 'Touring' : 'Guided tour'}</span>
      </button>
      <button type="button" className="dm-bar-btn dm-bar-reset" onClick={onReset}>
        <RotateCcw size={15} aria-hidden="true" />
        <span>Reset demo</span>
      </button>
      <Link
        to="/#demo"
        className="dm-bar-btn dm-bar-btn--cta"
        aria-label="Request a personalized demo"
        onClick={() => track('demo_request_cta_clicked', { from: 'demo_bar' })}
      >
        <span className="dm-bar-cta-long">Request a personalized demo</span>
        <span className="dm-bar-cta-short" aria-hidden="true">Request a demo</span>
      </Link>
      <Link to="/" className="dm-bar-btn dm-bar-exit" aria-label="Exit demo">
        <LogOut size={15} aria-hidden="true" />
        <span>Exit</span>
      </Link>
    </div>
  );
}
