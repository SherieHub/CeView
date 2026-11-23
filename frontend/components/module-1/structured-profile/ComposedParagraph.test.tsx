import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ComposedParagraph from './ComposedParagraph';

type Props = Parameters<typeof ComposedParagraph>[0];

function renderParagraph(overrides: Partial<Props> = {}) {
  const props: Props = {
    title: 'Generated Business Story',
    value: '',
    edited: false,
    complete: false,
    placeholder: 'Fill in every field above to generate your story',
    onChange: vi.fn(),
    onRegenerate: vi.fn(),
    ...overrides,
  };
  render(<ComposedParagraph {...props} />);
  return props;
}

describe('ComposedParagraph', () => {
  it('is disabled with the placeholder until the fields are complete', () => {
    renderParagraph();
    const box = screen.getByRole('textbox', { name: 'Generated Business Story' });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('placeholder', 'Fill in every field above to generate your story');
  });

  it('stays editable for hand-written text even when the fields are incomplete', () => {
    // A legacy profile: prose but no structured answers.
    renderParagraph({ value: 'Old prose.', edited: true, complete: false });
    expect(screen.getByRole('textbox', { name: 'Generated Business Story' })).toBeEnabled();
  });

  it('reports typed text through onChange', async () => {
    const props = renderParagraph({ value: 'Composed.', complete: true });
    await userEvent.type(screen.getByRole('textbox', { name: 'Generated Business Story' }), '!');
    expect(props.onChange).toHaveBeenLastCalledWith('Composed.!');
  });

  it('offers Regenerate and an edited marker only once edited with complete fields', async () => {
    const { unmount } = render(
      <ComposedParagraph title="T" value="x" edited={false} complete placeholder="" onChange={vi.fn()} onRegenerate={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /regenerate from fields/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/edited manually/i)).not.toBeInTheDocument();
    unmount();

    const props = renderParagraph({ value: 'Mine.', edited: true, complete: true });
    expect(screen.getByText(/edited manually/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /regenerate from fields/i }));
    expect(props.onRegenerate).toHaveBeenCalledOnce();
  });

  it('hides Regenerate while the fields are incomplete', () => {
    renderParagraph({ value: 'Mine.', edited: true, complete: false });
    expect(screen.queryByRole('button', { name: /regenerate from fields/i })).not.toBeInTheDocument();
  });

  it('copies the paragraph to the clipboard', async () => {
    const user = userEvent.setup();
    renderParagraph({ value: 'Copy me.', complete: true });
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(await navigator.clipboard.readText()).toBe('Copy me.');
  });

  it('disables Copy while there is nothing to copy', () => {
    renderParagraph();
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });
});
