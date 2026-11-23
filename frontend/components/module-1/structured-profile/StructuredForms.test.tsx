import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BusinessStoryForm from './BusinessStoryForm';
import UvpForm from './UvpForm';
import { EMPTY_STORY, EMPTY_UVP } from './profileTemplates';

describe('BusinessStoryForm', () => {
  function renderStory(onChange = vi.fn()) {
    render(
      <BusinessStoryForm
        businessName="Sunset Cove Beach Resort"
        coreServices={['Scuba Diving', 'Snorkeling']}
        value={EMPTY_STORY}
        onChange={onChange}
      />,
    );
    return onChange;
  }

  it('shows the business name as text, not as a second editable field', () => {
    renderStory();
    expect(screen.getByTestId('story-business-name')).toHaveTextContent('Sunset Cove Beach Resort');
    // Settings already has an editable "Business name"; a second labelled
    // control would make that label ambiguous.
    expect(screen.queryByLabelText(/business name/i)).not.toBeInTheDocument();
  });

  it('shows the core services in place of an offerings field', () => {
    renderStory();
    expect(screen.getByText('What products, activities, or services do you offer?')).toBeInTheDocument();
    expect(screen.getByText('Scuba Diving')).toBeInTheDocument();
    expect(screen.getByText('Snorkeling')).toBeInTheDocument();
  });

  it.each([
    ['Business type', 'storyBusinessType'],
    ['Location', 'storyLocation'],
    ['What can guests actually experience during a visit?', 'storyExperience'],
    ['What facilities, resources, or notable features do you have?', 'storyFacilities'],
  ])('reports "%s" edits as %s', (label, key) => {
    const onChange = renderStory();
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'typed' } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_STORY, [key]: 'typed' });
  });

  it('flags an answer below its minimum and confirms one that meets it', () => {
    const { rerender } = render(
      <BusinessStoryForm businessName="X" coreServices={['a']} value={{ ...EMPTY_STORY, storyLocation: 'Ce' }} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('hint-storyLocation')).toHaveTextContent('2 / 3 characters');
    rerender(
      <BusinessStoryForm businessName="X" coreServices={['a']} value={{ ...EMPTY_STORY, storyLocation: 'Ceb' }} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('hint-storyLocation')).toHaveTextContent('Looks good');
  });
});

describe('UvpForm', () => {
  it.each([
    ['1. What distinguishes your business from similar businesses?', 'uvpDistinguisher'],
    ['2. What specific feature or fact supports that difference?', 'uvpSupportingFact'],
    ['3. How does this benefit your guests?', 'uvpGuestBenefit'],
  ])('reports "%s" edits as %s', (label, key) => {
    const onChange = vi.fn();
    render(<UvpForm value={EMPTY_UVP} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'typed' } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_UVP, [key]: 'typed' });
  });

  it('shows a minimum hint on an empty answer', () => {
    render(<UvpForm value={EMPTY_UVP} onChange={vi.fn()} />);
    expect(screen.getByTestId('hint-uvpGuestBenefit')).toHaveTextContent('At least 20 characters');
  });

  it('only emits UVP keys even when given a larger object', () => {
    const onChange = vi.fn();
    render(<UvpForm value={{ ...EMPTY_UVP, businessName: 'X' } as typeof EMPTY_UVP} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/1\. What distinguishes/), { target: { value: 'typed' } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_UVP, uvpDistinguisher: 'typed' });
  });
});
