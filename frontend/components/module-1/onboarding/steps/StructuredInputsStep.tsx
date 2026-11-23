/**
 * Onboarding Step 3 — Structured Inputs: Business Story & UVP.
 *
 * The operator answers short questions instead of writing free prose. The
 * answers are composed into fixed template paragraphs (structured-profile/
 * profileTemplates.ts), and those paragraphs are what get saved as the
 * profile's description/uvp and sent to the AI services. A paragraph follows
 * its answers until the operator edits it by hand; "Regenerate from fields"
 * hands it back to the template.
 *
 * The step's Continue gate is stepValid() case 2 in obDraft.tsx.
 */
import { useEffect } from 'react';
import { useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';
import BusinessStoryForm from '../../structured-profile/BusinessStoryForm';
import UvpForm from '../../structured-profile/UvpForm';
import ComposedParagraph from '../../structured-profile/ComposedParagraph';
import {
  pickStory, pickUvp, storyComplete, syncComposed, uvpComplete,
} from '../../structured-profile/profileTemplates';

export default function StructuredInputsStep() {
  const { draft, setDraft } = useObDraft();
  const update = (next: ObDraft) => setDraft(syncComposed(next));

  // The business name and core services feed the story but are edited in
  // steps 1–2, so an untouched paragraph is refreshed on entry.
  useEffect(() => {
    const synced = syncComposed(draft);
    if (synced.description !== draft.description || synced.uvp !== draft.uvp) setDraft(synced);
    // Entry only — every later change goes through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="ob-step-intro">
        <p className="ob-step-eyebrow">Step 3 · Required</p>
        <h2 className="heading-lg">Tell your story in a few short answers</h2>
        <p className="body-sm" style={{ maxWidth: '56ch' }}>
          Your answers are combined into a Business Story and a Unique Value Proposition. The AI
          uses these two paragraphs to score your uniqueness and write your posts, so be specific.
        </p>
      </div>

      <section className="sp-section" aria-labelledby="ob-story-title">
        <h3 className="sp-form-title" id="ob-story-title">Business Story</h3>
        <BusinessStoryForm
          businessName={draft.businessName}
          coreServices={draft.coreServices}
          value={draft}
          onChange={(story) => update({ ...draft, ...story })}
        />
        <ComposedParagraph
          title="Generated Business Story"
          value={draft.description}
          edited={draft.descriptionEdited}
          complete={storyComplete(pickStory(draft), draft.coreServices)}
          placeholder="Fill in every field above to generate your story"
          onChange={(text) => setDraft({ ...draft, description: text, descriptionEdited: true })}
          onRegenerate={() => update({ ...draft, descriptionEdited: false })}
        />
      </section>

      <section className="sp-section" aria-labelledby="ob-uvp-title">
        <h3 className="sp-form-title" id="ob-uvp-title">Unique Value Proposition</h3>
        <UvpForm value={draft} onChange={(uvp) => update({ ...draft, ...uvp })} />
        <ComposedParagraph
          title="Combined UVP"
          value={draft.uvp}
          edited={draft.uvpEdited}
          complete={uvpComplete(pickUvp(draft))}
          placeholder="Fill in every field above to generate your UVP"
          onChange={(text) => setDraft({ ...draft, uvp: text, uvpEdited: true })}
          onRegenerate={() => update({ ...draft, uvpEdited: false })}
        />
      </section>
    </div>
  );
}
