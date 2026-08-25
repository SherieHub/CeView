import { Camera, Clapperboard } from 'lucide-react';
import { MOCK_CONTENT } from '../../../services/fixtures/content';
import type { VisualDirectionSlotProps } from './contentStudioTypes';

export default function VisualDirectionBoard({ activePlatform = 'instagram' }: Partial<VisualDirectionSlotProps>) {
  const guide = MOCK_CONTENT.captions[activePlatform].guide;
  return (
    <section className="card" aria-labelledby="visual-direction-title">
      <div className="flex items-start gap-3">
        <span className="conn-ico" aria-hidden="true"><Camera /></span>
        <div><h2 id="visual-direction-title" className="heading-lg">Visual direction</h2><p className="body-sm">Shot-list guidance for {activePlatform === 'naver' ? 'Naver Blog' : activePlatform}.</p></div>
      </div>
      <ol className="mt-5 space-y-3">
        {guide.map((item, index) => <li key={item} className="flex gap-3 rounded-lg bg-mint-pale p-3 text-sm leading-6 text-navy-dark"><span className="badge badge--teal">{index + 1}</span><span>{item}</span></li>)}
      </ol>
      <div className="mt-4 flex gap-2 rounded-lg border border-gray-light p-3 text-sm text-muted"><Clapperboard size={18} className="shrink-0 text-teal-accent" />Keep the final asset aligned with this direction—the compliance check evaluates caption-to-media consistency.</div>
    </section>
  );
}
