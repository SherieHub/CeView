/**
 * Business Story questions. The answers fill the template in
 * profileTemplates.ts (composeStory); the offerings slot is the operator's
 * core services, so it is shown here rather than asked again.
 */
import { useId } from 'react';
import StructuredField from './StructuredField';
import { MIN_CHARS, pickStory } from './profileTemplates';
import type { StoryInputs } from './profileTemplates';
import './structured-profile.css';

interface BusinessStoryFormProps {
  businessName: string;
  coreServices: string[];
  value: StoryInputs;
  onChange: (next: StoryInputs) => void;
}

export default function BusinessStoryForm({ businessName, coreServices, value, onChange }: BusinessStoryFormProps) {
  const servicesId = useId();
  const set = (key: keyof StoryInputs) => (text: string) => onChange({ ...pickStory(value), [key]: text });

  return (
    <div className="sp-form">
      {/* Display text, not a read-only input: Settings already has an editable
          "Business name" control, and a second one would make that label ambiguous. */}
      <div className="sp-field">
        <p className="field-label">Business name</p>
        <p className="input sp-readonly" data-testid="story-business-name">{businessName || '—'}</p>
        <p className="field-hint">Taken from your basic information.</p>
      </div>

      <div className="sp-two">
        <StructuredField
          name="storyBusinessType"
          label="Business type"
          placeholder="e.g. beachfront resort"
          value={value.storyBusinessType}
          min={MIN_CHARS.storyBusinessType}
          onChange={set('storyBusinessType')}
        />
        <StructuredField
          name="storyLocation"
          label="Location"
          placeholder="e.g. Moalboal, Cebu"
          value={value.storyLocation}
          min={MIN_CHARS.storyLocation}
          onChange={set('storyLocation')}
        />
      </div>

      <div className="sp-field">
        <p className="field-label" id={servicesId}>What products, activities, or services do you offer?</p>
        {coreServices.length ? (
          <ul className="sp-chips" aria-labelledby={servicesId}>
            {coreServices.map((s) => <li key={s} className="sp-chip">{s}</li>)}
          </ul>
        ) : (
          <p className="field-hint bad">Add at least one core service first.</p>
        )}
        <p className="field-hint">From your core services.</p>
      </div>

      <StructuredField
        name="storyExperience"
        label="What can guests actually experience during a visit?"
        placeholder="e.g. stay near the sardine run and explore the reef with local guides"
        help={<>Completes the sentence “…where guests can ___.”</>}
        multiline
        value={value.storyExperience}
        min={MIN_CHARS.storyExperience}
        onChange={set('storyExperience')}
      />
      <StructuredField
        name="storyFacilities"
        label="What facilities, resources, or notable features do you have?"
        placeholder="e.g. twelve villas, a dive shop, and a kitchen using locally sourced ingredients"
        help={<>Completes the sentence “Our facilities and services include ___.”</>}
        multiline
        value={value.storyFacilities}
        min={MIN_CHARS.storyFacilities}
        onChange={set('storyFacilities')}
      />
    </div>
  );
}
