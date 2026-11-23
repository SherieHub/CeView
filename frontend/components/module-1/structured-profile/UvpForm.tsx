/** Unique Value Proposition questions — each answer becomes one sentence of composeUvp(). */
import StructuredField from './StructuredField';
import { MIN_CHARS, pickUvp } from './profileTemplates';
import type { UvpInputs } from './profileTemplates';
import './structured-profile.css';

interface UvpFormProps {
  value: UvpInputs;
  onChange: (next: UvpInputs) => void;
}

export default function UvpForm({ value, onChange }: UvpFormProps) {
  const set = (key: keyof UvpInputs) => (text: string) => onChange({ ...pickUvp(value), [key]: text });

  return (
    <div className="sp-form">
      <StructuredField
        name="uvpDistinguisher"
        label="1. What distinguishes your business from similar businesses?"
        placeholder="e.g. Our diving activities are guided by local Moalboal residents."
        help={<>Describe something specific, rather than simply saying “best” or “high quality.”</>}
        multiline
        value={value.uvpDistinguisher}
        min={MIN_CHARS.uvpDistinguisher}
        onChange={set('uvpDistinguisher')}
      />
      <StructuredField
        name="uvpSupportingFact"
        label="2. What specific feature or fact supports that difference?"
        placeholder="e.g. Our house reef is approximately 30 metres from the villas."
        help="Examples: location, distance, facilities, expertise, certifications, or sourcing practices."
        multiline
        value={value.uvpSupportingFact}
        min={MIN_CHARS.uvpSupportingFact}
        onChange={set('uvpSupportingFact')}
      />
      <StructuredField
        name="uvpGuestBenefit"
        label="3. How does this benefit your guests?"
        placeholder="e.g. Guests can access the reef conveniently and learn about the area from local guides."
        multiline
        value={value.uvpGuestBenefit}
        min={MIN_CHARS.uvpGuestBenefit}
        onChange={set('uvpGuestBenefit')}
      />
    </div>
  );
}
