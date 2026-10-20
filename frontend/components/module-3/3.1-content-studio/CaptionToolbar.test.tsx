import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CaptionToolbar from './CaptionToolbar';
import type { StudioPlatformId } from './contentStudioTypes';

function Harness({ initial = 'Visit Cebu now', platform = 'instagram' as StudioPlatformId }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <textarea aria-label="Caption" ref={ref} value={value} onChange={(e) => setValue(e.target.value)} />
      <CaptionToolbar value={value} onChange={setValue} textareaRef={ref} platform={platform} />
    </>
  );
}

const field = () => screen.getByLabelText('Caption') as HTMLTextAreaElement;
const select = (start: number, end: number) => field().setSelectionRange(start, end);

describe('CaptionToolbar', () => {
  it('bolds the selection, then undoes and redoes it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    select(6, 10);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(field()).toHaveValue('Visit 𝗖𝗲𝗯𝘂 now');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(field()).toHaveValue('Visit Cebu now');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(field()).toHaveValue('Visit 𝗖𝗲𝗯𝘂 now');
  });

  it('undoes typing too, with the keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(<Harness initial="" />);
    await user.click(field());
    await user.type(field(), 'Hello');
    expect(field()).toHaveValue('Hello');
    await user.keyboard('{Control>}z{/Control}');
    expect(field()).toHaveValue('');
  });

  it('applies italic and underline from the shortcuts', async () => {
    const user = userEvent.setup();
    render(<Harness initial="go" />);
    await user.click(field());
    select(0, 2);
    await user.keyboard('{Control>}u{/Control}');
    expect(field()).toHaveValue('g̲o̲');
  });

  it('turns lines into a list and tidies spacing', async () => {
    const user = userEvent.setup();
    render(<Harness initial={'Dive\nStay  \n\n\n\nEat'} />);
    select(0, 4);
    await user.click(screen.getByRole('button', { name: 'Numbered list' }));
    expect(field()).toHaveValue('1. Dive\nStay  \n\n\n\nEat');
    await user.click(screen.getByRole('button', { name: 'Tidy spacing' }));
    expect(field()).toHaveValue('1. Dive\nStay\n\nEat');
  });

  it('inserts an emoji where the cursor was', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Sunset" />);
    select(6, 6);
    await user.click(screen.getByRole('button', { name: 'Insert emoji' }));
    await user.click(screen.getByRole('button', { name: 'palm tree' }));
    expect(field()).toHaveValue('Sunset 🌴');
    expect(screen.queryByRole('dialog', { name: 'Insert emoji' })).toBeNull();
  });

  it('inserts a checked link, and is honest about clickability', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Book:" />);
    select(5, 5);
    await user.click(screen.getByRole('button', { name: 'Insert link' }));
    expect(screen.getByText(/aren’t clickable there/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Link address'), 'not a link');
    await user.click(screen.getByRole('button', { name: 'Insert' }));
    expect(screen.getByText(/Enter a web address/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Link address'));
    await user.type(screen.getByLabelText('Link address'), 'sunsetcove.ph{Enter}');
    expect(field()).toHaveValue('Book: https://sunsetcove.ph');
  });

  it('closes a popover on Escape and returns focus to its button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Insert emoji' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Insert emoji' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Insert emoji' })).toHaveFocus();
  });
});
