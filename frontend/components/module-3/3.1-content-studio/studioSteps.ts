/**
 * The linear journey's steps — one source of truth shared by the left-margin
 * rail (StudioStepRail) and the sections themselves, so a heading and its
 * indicator stay in sync.
 *
 * `sectionId` is the DOM id the section element carries; the rail's
 * scroll-spy observes those nodes and its links target them.
 * The template-literal type enforces that `sectionId` always follows
 * the pattern `studio-step-${id}`, preventing mismatches at compile time.
 */
export type StudioStepId = 'draft' | 'attach' | 'validate';

export interface StudioStep {
  id: StudioStepId;
  number: number;
  label: string;
  /** Always `studio-step-${id}` — the template type keeps the two in lockstep. */
  sectionId: `studio-step-${StudioStepId}`;
}

export const STUDIO_STEPS: StudioStep[] = [
  { id: 'draft', number: 1, label: 'Draft', sectionId: 'studio-step-draft' },
  { id: 'attach', number: 2, label: 'Attach', sectionId: 'studio-step-attach' },
  { id: 'validate', number: 3, label: 'Validate', sectionId: 'studio-step-validate' },
];
