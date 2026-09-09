import { describe, expect, it } from 'vitest';
import { STUDIO_STEPS } from './studioSteps';

describe('STUDIO_STEPS', () => {
  it('numbers the steps from 1 with unique ids and DOM-safe section ids', () => {
    expect(STUDIO_STEPS.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(STUDIO_STEPS.map((s) => s.label)).toEqual(['Draft', 'Attach', 'Validate']);

    const ids = STUDIO_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    STUDIO_STEPS.forEach((s) => {
      expect(s.sectionId).toMatch(/^studio-step-[a-z]+$/);
    });

    // Verify that each sectionId matches the pattern `studio-step-${id}`
    STUDIO_STEPS.forEach((s) => {
      expect(s.sectionId).toBe(`studio-step-${s.id}`);
    });

    // Verify that all sectionIds are unique
    const sectionIds = STUDIO_STEPS.map((s) => s.sectionId);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });
});
