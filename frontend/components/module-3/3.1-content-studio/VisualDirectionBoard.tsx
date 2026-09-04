import { useEffect, useState } from 'react';
import { Camera, Clapperboard, Loader2 } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { CreativeDirection } from '../../../types';
import type { VisualDirectionSlotProps } from './contentStudioTypes';

export default function VisualDirectionBoard({ activePlatform = 'instagram' }: Partial<VisualDirectionSlotProps>) {
  const [direction, setDirection] = useState<CreativeDirection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient.creativeDirection
      .generate()
      .then((result) => { if (!cancelled) setDirection(result); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="card" aria-labelledby="visual-direction-title">
      <div className="flex items-start gap-3">
        <span className="conn-ico" aria-hidden="true"><Camera /></span>
        <div><h2 id="visual-direction-title" className="heading-lg">Visual direction</h2><p className="body-sm">Shot-list guidance for {activePlatform}.</p></div>
      </div>

      {loading && (
        <p className="mt-5 flex items-center gap-2 rounded-lg bg-mint-pale p-3 text-sm text-navy-dark">
          <Loader2 size={16} className="animate-spin" /> Generating creative direction…
        </p>
      )}

      {!loading && error != null && <div className="mt-5"><ApiErrorPanel error={error} label="Visual direction" /></div>}

      {!loading && error == null && direction && (
        <>
          <ol className="mt-5 space-y-3">
            {direction.visualGuide.map((item, index) => <li key={item} className="flex gap-3 rounded-lg bg-mint-pale p-3 text-sm leading-6 text-navy-dark"><span className="badge badge--teal">{index + 1}</span><span>{item}</span></li>)}
          </ol>

          {direction.shots.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-navy-dark">Shot list</h3>
              {direction.shots.map((shot) => (
                <div key={shot.label} className="rounded-lg border border-gray-light p-3">
                  <p className="text-sm font-semibold text-navy-dark">{shot.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{shot.description}</p>
                  <p className="mt-1 text-xs text-teal-accent">Lighting: {shot.lighting}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-gray-light p-3">
            <h3 className="text-sm font-semibold text-navy-dark">Moodboard</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{direction.moodboard.palette}</p>
            {direction.moodboard.references.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
                {direction.moodboard.references.map((ref) => <li key={ref}>{ref}</li>)}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2 rounded-lg border border-gray-light p-3 text-sm text-[var(--color-text-muted)]"><Clapperboard size={18} className="shrink-0 text-teal-accent" />Keep the final asset aligned with this direction—the compliance check evaluates caption-to-media consistency.</div>
    </section>
  );
}
