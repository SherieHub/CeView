/**
 * CARD — Onboarding: Step 3 Structured Inputs
 * Depends on: Card 4 (Wizard Shell & Step 1)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
 *
 * Definition of Done: covers both word-count gates (description ≥50 words,
 * uvp ≥30 words) independently — i.e. each field's hint state is asserted
 * without assuming anything about the other field's contents.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ObDraftProvider } from '../obDraft';
import StructuredInputsStep from './StructuredInputsStep';

function renderStep() {
  return render(
    <ObDraftProvider>
      <StructuredInputsStep />
    </ObDraftProvider>
  );
}

/**
 * userEvent.type() sends one keystroke per character, and these fields take
 * 50-80 word strings — ~450 characters, each one a React re-render. That made
 * this file take ~40s on its own and time out at 10s per test once the suite
 * grew enough to run it under real parallel load.
 *
 * These tests assert the word-count hint that results from a field's value,
 * not per-keystroke behaviour, so a paste is the same assertion in one event.
 * It is also the more realistic gesture for a long business description.
 */
async function pasteInto(element: HTMLElement, text: string): Promise<void> {
  await userEvent.click(element);
  await userEvent.paste(text);
}

function words(n: number, prefix = 'word'): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('StructuredInputsStep — description gate (min 50 words)', () => {
  it('shows the neutral "Min 50 words" hint when empty', () => {
    renderStep();
    expect(screen.getByTestId('hint-description')).toHaveTextContent('Min 50 words');
  });

  it('shows a red "X more needed" hint below the threshold', async () => {
    renderStep();
    const textarea = screen.getByPlaceholderText(/what is the property/i);
    await pasteInto(textarea, words(10));

    const hint = screen.getByTestId('hint-description');
    expect(hint).toHaveTextContent('10 / 50 words — 40 more needed');
  });

  it('shows the green "threshold met" hint at exactly 50 words', async () => {
    renderStep();
    const textarea = screen.getByPlaceholderText(/what is the property/i);
    await pasteInto(textarea, words(50));

    const hint = screen.getByTestId('hint-description');
    expect(hint).toHaveTextContent('50 words — threshold met');
  });

  it('stays green above the threshold', async () => {
    renderStep();
    const textarea = screen.getByPlaceholderText(/what is the property/i);
    await pasteInto(textarea, words(65));

    const hint = screen.getByTestId('hint-description');
    expect(hint).toHaveTextContent('65 words — threshold met');
  });
});

describe('StructuredInputsStep — uvp gate (min 30 words)', () => {
  it('shows the neutral "Min 30 words" hint when empty', () => {
    renderStep();
    expect(screen.getByTestId('hint-uvp')).toHaveTextContent('Min 30 words');
  });

  it('shows a red "X more needed" hint below the threshold', async () => {
    renderStep();
    const textarea = screen.getByPlaceholderText(/what can a guest get here/i);
    await pasteInto(textarea, words(12));

    const hint = screen.getByTestId('hint-uvp');
    expect(hint).toHaveTextContent('12 / 30 words — 18 more needed');
  });

  it('shows the green "threshold met" hint at exactly 30 words', async () => {
    renderStep();
    const textarea = screen.getByPlaceholderText(/what can a guest get here/i);
    await pasteInto(textarea, words(30));

    const hint = screen.getByTestId('hint-uvp');
    expect(hint).toHaveTextContent('30 words — threshold met');
  });
});

describe('StructuredInputsStep — gates are independent', () => {
  it('description crossing its threshold does not affect the uvp hint', async () => {
    renderStep();
    const descTextarea = screen.getByPlaceholderText(/what is the property/i);
    await pasteInto(descTextarea, words(80));

    // uvp untouched — should still read the empty/neutral state
    expect(screen.getByTestId('hint-uvp')).toHaveTextContent('Min 30 words');
  }, 15000); // Slightly longer here since it's 80 words!

  it('uvp crossing its threshold does not affect the description hint', async () => {
    renderStep();
    const uvpTextarea = screen.getByPlaceholderText(/what can a guest get here/i);
    await pasteInto(uvpTextarea, words(40));

    // description untouched — should still read the empty/neutral state
    expect(screen.getByTestId('hint-description')).toHaveTextContent('Min 50 words');
  });

  it('both fields can independently reach green at the same time', async () => {
    renderStep();
    const descTextarea = screen.getByPlaceholderText(/what is the property/i);
    const uvpTextarea = screen.getByPlaceholderText(/what can a guest get here/i);

    await pasteInto(descTextarea, words(50));
    await pasteInto(uvpTextarea, words(30));

    expect(screen.getByTestId('hint-description')).toHaveTextContent('threshold met');
    expect(screen.getByTestId('hint-uvp')).toHaveTextContent('threshold met');
  }, 15000); // 80 words total being typed here
});