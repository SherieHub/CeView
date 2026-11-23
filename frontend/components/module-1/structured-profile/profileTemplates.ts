/**
 * Structured Business Story & UVP — the template paragraphs the AI services
 * receive in place of free-form prose.
 *
 * The operator answers short questions; the answers are slotted into fixed
 * templates here, and the composed paragraphs are what get saved as the
 * profile's `description` and `uvp` (the strings SBERT, the classifier, the
 * caption prompt and the compliance audit already consume). The individual
 * answers are persisted alongside so they can be re-edited.
 *
 * Single source of truth for onboarding step 3 and Settings. The per-field
 * minimums and the all-or-nothing rule are mirrored server-side in
 * BusinessProfileController — change both together.
 */

export interface StoryInputs {
  storyBusinessType: string;
  storyLocation: string;
  storyExperience: string;
  storyFacilities: string;
}

export interface UvpInputs {
  uvpDistinguisher: string;
  uvpSupportingFact: string;
  uvpGuestBenefit: string;
}

export const EMPTY_STORY: StoryInputs = { storyBusinessType: '', storyLocation: '', storyExperience: '', storyFacilities: '' };
export const EMPTY_UVP: UvpInputs = { uvpDistinguisher: '', uvpSupportingFact: '', uvpGuestBenefit: '' };

/** Blank answers and untouched paragraphs — spread into a new draft or profile. */
export const EMPTY_STRUCTURED = { ...EMPTY_STORY, ...EMPTY_UVP, descriptionEdited: false, uvpEdited: false };

/** Minimum trimmed length, in characters, of each answer. */
export const MIN_CHARS = {
  storyBusinessType: 3,
  storyLocation: 3,
  storyExperience: 20,
  storyFacilities: 20,
  uvpDistinguisher: 20,
  uvpSupportingFact: 20,
  uvpGuestBenefit: 20,
} as const satisfies Record<keyof StoryInputs | keyof UvpInputs, number>;

/** Just the story answers, from an object that may carry more (a draft, a profile). */
export function pickStory(source: StoryInputs): StoryInputs {
  const { storyBusinessType, storyLocation, storyExperience, storyFacilities } = source;
  return { storyBusinessType, storyLocation, storyExperience, storyFacilities };
}

/** Just the UVP answers, from an object that may carry more (a draft, a profile). */
export function pickUvp(source: UvpInputs): UvpInputs {
  const { uvpDistinguisher, uvpSupportingFact, uvpGuestBenefit } = source;
  return { uvpDistinguisher, uvpSupportingFact, uvpGuestBenefit };
}

const meets = (value: string, min: number) => String(value ?? '').trim().length >= min;

/** Trim and drop trailing punctuation so the answer can sit mid-sentence. */
function clause(value: string): string {
  return String(value ?? '').trim().replace(/[.,;:!?\s]+$/, '');
}

/** Trim and make sure the answer ends like a sentence. */
function sentence(value: string): string {
  const trimmed = String(value ?? '').trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** "a", "a and b", "a, b, and c" — blank items are dropped. */
export function joinList(items: string[]): string {
  const clean = items.map((i) => i.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? '';
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

/** "an" before a vowel letter, otherwise "a". */
export function article(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word.trim()) ? 'an' : 'a';
}

export function composeStory(businessName: string, coreServices: string[], inputs: StoryInputs): string {
  const type = clause(inputs.storyBusinessType);
  return (
    `${businessName.trim()} is ${article(type)} ${type} located in ${clause(inputs.storyLocation)}. ` +
    `We offer ${joinList(coreServices)}, where guests can ${clause(inputs.storyExperience)}. ` +
    `Our facilities and services include ${clause(inputs.storyFacilities)}.`
  );
}

export function composeUvp(inputs: UvpInputs): string {
  return [inputs.uvpDistinguisher, inputs.uvpSupportingFact, inputs.uvpGuestBenefit].map(sentence).join(' ');
}

export function storyComplete(inputs: StoryInputs, coreServices: string[]): boolean {
  return (
    coreServices.some((s) => s.trim() !== '') &&
    (Object.keys(EMPTY_STORY) as (keyof StoryInputs)[]).every((k) => meets(inputs[k], MIN_CHARS[k]))
  );
}

export function uvpComplete(inputs: UvpInputs): boolean {
  return (Object.keys(EMPTY_UVP) as (keyof UvpInputs)[]).every((k) => meets(inputs[k], MIN_CHARS[k]));
}

/** No answer given at all — a profile created before structured inputs existed. */
export function structuredAllBlank(story: StoryInputs, uvp: UvpInputs): boolean {
  return [...Object.values(story), ...Object.values(uvp)].every((v) => String(v ?? '').trim() === '');
}

/**
 * All-or-nothing: either every answer is blank (legacy) or every answer meets
 * its minimum. Core services are not part of this rule — they are gated in
 * onboarding step 2.
 */
export function structuredValid(story: StoryInputs, uvp: UvpInputs): boolean {
  if (structuredAllBlank(story, uvp)) return true;
  return (Object.keys(EMPTY_STORY) as (keyof StoryInputs)[]).every((k) => meets(story[k], MIN_CHARS[k]))
    && uvpComplete(uvp);
}

/** Everything a screen holding a structured profile carries (an onboarding draft, a BusinessProfile). */
export type StructuredProfile = StoryInputs & UvpInputs & {
  businessName: string;
  coreServices: string[];
  description: string;
  uvp: string;
  /** The paragraph was hand-edited, so the template no longer overwrites it. */
  descriptionEdited: boolean;
  uvpEdited: boolean;
};

/**
 * Rebuild every paragraph the operator has not hand-edited from its answers;
 * an untouched paragraph whose answers are incomplete is empty. Call after
 * any change to the answers, the business name or the core services.
 */
export function syncComposed<T extends StructuredProfile>(p: T): T {
  const story = pickStory(p);
  const uvp = pickUvp(p);
  return {
    ...p,
    description: p.descriptionEdited
      ? p.description
      : storyComplete(story, p.coreServices) ? composeStory(p.businessName, p.coreServices, story) : '',
    uvp: p.uvpEdited ? p.uvp : uvpComplete(uvp) ? composeUvp(uvp) : '',
  };
}

const blank = (values: string[]) => values.every((v) => String(v ?? '').trim() === '');

/**
 * A paragraph with text but no answers behind it was written by hand (a
 * profile from before structured inputs, or one seeded without answers), so
 * it is flagged edited and syncComposed() will not overwrite it. Mirrored by
 * BusinessProfileController on save.
 */
export function withLegacyFlags<T extends StructuredProfile>(p: T): T {
  return {
    ...p,
    descriptionEdited: p.descriptionEdited || (blank(Object.values(pickStory(p))) && p.description.trim() !== ''),
    uvpEdited: p.uvpEdited || (blank(Object.values(pickUvp(p))) && p.uvp.trim() !== ''),
  };
}
