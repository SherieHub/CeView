import { describe, it, expect } from 'vitest';
import {
  composeStory,
  composeUvp,
  joinList,
  article,
  storyComplete,
  uvpComplete,
  structuredAllBlank,
  structuredValid,
  EMPTY_STORY,
  EMPTY_UVP,
  syncComposed,
  withLegacyFlags,
} from './profileTemplates';
import type { StoryInputs, UvpInputs } from './profileTemplates';

const MOCKUP_STORY: StoryInputs = {
  storyBusinessType: 'beachfront resort',
  storyLocation: 'Moalboal, Cebu',
  storyExperience: 'stay near the sardine run and explore the reef with local guides',
  storyFacilities: 'twelve villas, a dive shop, and a kitchen using locally sourced ingredients',
};
const MOCKUP_SERVICES = ['beachfront accommodation', 'scuba diving', 'snorkeling', 'island hopping'];
const MOCKUP_UVP: UvpInputs = {
  uvpDistinguisher: 'Our diving activities are guided by local Moalboal residents.',
  uvpSupportingFact: 'Our house reef is approximately 30 metres from the villas.',
  uvpGuestBenefit: 'Guests can access the reef conveniently and learn about the area from local guides.',
};

describe('composeStory', () => {
  it('reproduces the Business Story mockup exactly', () => {
    expect(composeStory('Sunset Cove Beach Resort', MOCKUP_SERVICES, MOCKUP_STORY)).toBe(
      'Sunset Cove Beach Resort is a beachfront resort located in Moalboal, Cebu. We offer ' +
        'beachfront accommodation, scuba diving, snorkeling, and island hopping, where guests can ' +
        'stay near the sardine run and explore the reef with local guides. Our facilities and ' +
        'services include twelve villas, a dive shop, and a kitchen using locally sourced ingredients.',
    );
  });

  it('trims answers and strips trailing punctuation before inserting them', () => {
    const story = composeStory('  Cafe Uno ', [' coffee '], {
      storyBusinessType: ' café. ',
      storyLocation: 'Cebu City,',
      storyExperience: 'sip single-origin coffee!',
      storyFacilities: 'a roastery;',
    });
    expect(story).toBe(
      'Cafe Uno is a café located in Cebu City. We offer coffee, where guests can sip ' +
        'single-origin coffee. Our facilities and services include a roastery.',
    );
  });

  it('uses "an" for a business type starting with a vowel', () => {
    expect(composeStory('X', ['a'], { ...MOCKUP_STORY, storyBusinessType: 'eco resort' })).toContain(
      'X is an eco resort located',
    );
  });
});

describe('composeUvp', () => {
  it('reproduces the Combined UVP mockup exactly', () => {
    expect(composeUvp(MOCKUP_UVP)).toBe(
      'Our diving activities are guided by local Moalboal residents. Our house reef is ' +
        'approximately 30 metres from the villas. Guests can access the reef conveniently and ' +
        'learn about the area from local guides.',
    );
  });

  it('adds a closing period only when an answer has no sentence-ending punctuation', () => {
    expect(
      composeUvp({ uvpDistinguisher: ' We roast daily ', uvpSupportingFact: 'Beans arrive weekly!', uvpGuestBenefit: 'Fresh cups?' }),
    ).toBe('We roast daily. Beans arrive weekly! Fresh cups?');
  });
});

describe('joinList', () => {
  it('handles one, two and three-plus items', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b, and c');
  });

  it('ignores blank items', () => {
    expect(joinList([' a ', '', '  ', 'b'])).toBe('a and b');
  });
});

describe('article', () => {
  it('picks "an" for a/e/i/o/u regardless of case and "a" otherwise', () => {
    expect(article('Inn')).toBe('an');
    expect(article('eco resort')).toBe('an');
    expect(article('beachfront resort')).toBe('a');
  });
});

describe('completeness', () => {
  it('requires 3 chars for type and location, 20 for sentence answers, and a core service', () => {
    expect(storyComplete(MOCKUP_STORY, MOCKUP_SERVICES)).toBe(true);
    expect(storyComplete(MOCKUP_STORY, [])).toBe(false);
    expect(storyComplete({ ...MOCKUP_STORY, storyBusinessType: 'ab' }, MOCKUP_SERVICES)).toBe(false);
    expect(storyComplete({ ...MOCKUP_STORY, storyBusinessType: 'abc' }, MOCKUP_SERVICES)).toBe(true);
    expect(storyComplete({ ...MOCKUP_STORY, storyLocation: '  ab  ' }, MOCKUP_SERVICES)).toBe(false);
    expect(storyComplete({ ...MOCKUP_STORY, storyFacilities: 'x'.repeat(19) }, MOCKUP_SERVICES)).toBe(false);
    expect(storyComplete({ ...MOCKUP_STORY, storyFacilities: 'x'.repeat(20) }, MOCKUP_SERVICES)).toBe(true);
  });

  it('requires 20 chars for every UVP answer', () => {
    expect(uvpComplete(MOCKUP_UVP)).toBe(true);
    expect(uvpComplete({ ...MOCKUP_UVP, uvpGuestBenefit: 'x'.repeat(19) })).toBe(false);
    expect(uvpComplete({ ...MOCKUP_UVP, uvpGuestBenefit: 'x'.repeat(20) })).toBe(true);
  });
});

describe('all-or-nothing rule', () => {
  it('treats all-blank answers as a legacy profile', () => {
    expect(structuredAllBlank(EMPTY_STORY, EMPTY_UVP)).toBe(true);
    expect(structuredAllBlank({ ...EMPTY_STORY, storyLocation: '  ' }, EMPTY_UVP)).toBe(true);
    expect(structuredAllBlank({ ...EMPTY_STORY, storyLocation: 'Cebu' }, EMPTY_UVP)).toBe(false);
  });

  it('accepts all blank or all valid, and rejects partial or too-short answers', () => {
    expect(structuredValid(EMPTY_STORY, EMPTY_UVP)).toBe(true);
    expect(structuredValid(MOCKUP_STORY, MOCKUP_UVP)).toBe(true);
    expect(structuredValid(MOCKUP_STORY, EMPTY_UVP)).toBe(false);
    expect(structuredValid({ ...MOCKUP_STORY, storyLocation: 'ab' }, MOCKUP_UVP)).toBe(false);
  });
});

describe('syncComposed', () => {
  const base = {
    businessName: 'Sunset Cove Beach Resort',
    coreServices: MOCKUP_SERVICES,
    ...MOCKUP_STORY,
    ...MOCKUP_UVP,
    description: 'stale',
    uvp: 'stale',
    descriptionEdited: false,
    uvpEdited: false,
    slogan: 'kept as-is',
  };

  it('rebuilds paragraphs that are not hand-edited and keeps other fields', () => {
    const synced = syncComposed(base);
    expect(synced.description).toBe(composeStory(base.businessName, base.coreServices, MOCKUP_STORY));
    expect(synced.uvp).toBe(composeUvp(MOCKUP_UVP));
    expect(synced.slogan).toBe('kept as-is');
  });

  it('leaves hand-edited paragraphs alone', () => {
    const synced = syncComposed({ ...base, descriptionEdited: true, uvpEdited: true });
    expect(synced.description).toBe('stale');
    expect(synced.uvp).toBe('stale');
  });

  it('empties an untouched paragraph whose fields are incomplete', () => {
    const synced = syncComposed({ ...base, storyLocation: '', uvpGuestBenefit: '' });
    expect(synced.description).toBe('');
    expect(synced.uvp).toBe('');
  });
});

describe('withLegacyFlags', () => {
  const legacy = {
    businessName: 'X',
    coreServices: ['a'],
    ...EMPTY_STORY,
    ...EMPTY_UVP,
    description: 'Prose written before structured inputs.',
    uvp: 'Prose UVP.',
    descriptionEdited: false,
    uvpEdited: false,
  };

  it('marks prose with no answers behind it as hand-edited, so the template cannot wipe it', () => {
    const p = withLegacyFlags(legacy);
    expect(p.descriptionEdited).toBe(true);
    expect(p.uvpEdited).toBe(true);
    expect(syncComposed({ ...p, businessName: 'Y' }).description).toBe(legacy.description);
  });

  it('judges each paragraph by its own answers', () => {
    const p = withLegacyFlags({ ...legacy, ...MOCKUP_UVP });
    expect(p.descriptionEdited).toBe(true);
    expect(p.uvpEdited).toBe(false);
  });

  it('leaves empty paragraphs and already-flagged ones alone', () => {
    expect(withLegacyFlags({ ...legacy, description: '', uvp: ' ' })).toMatchObject({
      descriptionEdited: false,
      uvpEdited: false,
    });
  });
});
