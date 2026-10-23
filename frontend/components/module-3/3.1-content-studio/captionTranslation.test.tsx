/**
 * The English translation toggle: which text gets it, how the cache behaves, and the
 * three places it shows up (option cards, editable composer, stale-translation reset).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CaptionOptionGrid from './CaptionOptionGrid';
import PublishComposer from './PublishComposer';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { hasNonEnglishScript, nativeLanguageOf } from './captionLanguage';
import {
  getTranslation,
  requestTranslation,
  resetCaptionTranslations,
  seedFromContent,
} from './captionTranslationStore';
import { blankPost, emptyCampaign, reconcilePost } from './campaigns/campaignTypes';
import type { PlatformCaptions } from '../../../types';
import type { PublishDraftState } from './contentStudioTypes';
import { buildContentResponse } from './testFixtures';

const translate = vi.fn();
const localize = vi.fn();
vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    vouchers: { list: vi.fn(() => Promise.resolve([])) },
    content: {
      translate: (...args: unknown[]) => translate(...args),
      localize: (...args: unknown[]) => localize(...args),
    },
  },
}));

const KO = '세부 힐링여행을 떠나요 🌴 #세부여행';
const KO_EN = 'Let’s go on a healing trip to Cebu 🌴 #세부여행 (Cebu trip)';

beforeEach(() => {
  resetCaptionTranslations();
  translate.mockReset();
  localize.mockReset();
  translate.mockResolvedValue({ captionEn: KO_EN, sourceLanguage: 'ko', source: 'groq' });
});

describe('captionLanguage', () => {
  it('detects Hangul, kana and Han, and ignores Latin text', () => {
    expect(hasNonEnglishScript('힐링')).toBe(true);
    expect(hasNonEnglishScript('セブ島')).toBe(true);
    expect(hasNonEnglishScript('絶景')).toBe(true);
    expect(hasNonEnglishScript('Cebu 🌴 café')).toBe(false);
    expect(hasNonEnglishScript('Dive now #세부여행')).toBe(true);
  });

  it('infers the language to localise back into', () => {
    expect(nativeLanguageOf('힐링')).toBe('ko');
    expect(nativeLanguageOf('セブ島で癒し')).toBe('ja');
    expect(nativeLanguageOf('絶景')).toBe('ja');
    expect(nativeLanguageOf('hello')).toBeNull();
  });
});

describe('captionTranslationStore', () => {
  it('shares one API call between concurrent requests for the same text', async () => {
    const [a, b] = await Promise.all([requestTranslation(KO), requestTranslation(KO)]);
    expect(a).toBe(KO_EN);
    expect(b).toBe(KO_EN);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(getTranslation(KO)).toBe(KO_EN);
  });

  it('does not cache a failure, so a retry calls again', async () => {
    translate.mockRejectedValueOnce(new Error('503'));
    await expect(requestTranslation(KO)).rejects.toThrow();
    await expect(requestTranslation(KO)).resolves.toBe(KO_EN);
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('is seeded from a generate response', () => {
    const content = buildContentResponse();
    content.captions.instagram.options[0] = KO;
    content.captions.instagram.optionsEn = [KO_EN, '', ''];
    seedFromContent(content);
    expect(getTranslation(KO)).toBe(KO_EN);
  });
});

const CAPTIONS: PlatformCaptions = {
  optionNames: ['A', 'B'],
  options: [KO, 'An all-English caption'],
  optionsEn: [KO_EN, ''],
  optionMetadata: [],
  guide: [],
};

describe('CaptionOptionGrid — Show English', () => {
  it('shows the toggle only on non-English captions and swaps the text in place', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <OverlayStackProvider>
        <CaptionOptionGrid captions={CAPTIONS} selectedIndex={null} onSelect={onSelect} />
      </OverlayStackProvider>,
    );

    expect(screen.getAllByRole('button', { name: /Show English/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Show English for A' }));

    expect(screen.getByTestId('cap-body-0').textContent).toBe(KO_EN);
    expect(translate).not.toHaveBeenCalled(); // already known from generation
    expect(onSelect).not.toHaveBeenCalled(); // the toggle is not a card click

    await user.click(screen.getByRole('button', { name: 'Show original for A' }));
    expect(screen.getByTestId('cap-body-0').textContent).toBe(KO);

    // Selecting always stages the native text, never the English reading aid.
    await user.click(screen.getByRole('button', { name: 'Show English for A' }));
    await user.click(screen.getAllByRole('button', { name: 'Select' })[0]);
    expect(onSelect).toHaveBeenCalledWith(0, KO);
  });

  it('translates on demand when generation supplied no English', async () => {
    const user = userEvent.setup();
    render(
      <OverlayStackProvider>
        <CaptionOptionGrid captions={{ ...CAPTIONS, optionsEn: ['', ''] }} selectedIndex={null} onSelect={vi.fn()} />
      </OverlayStackProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show English for A' }));
    await waitFor(() => expect(screen.getByTestId('cap-body-0').textContent).toBe(KO_EN));
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('keeps the expanded view open when its toggle is used', async () => {
    const user = userEvent.setup();
    render(
      <OverlayStackProvider>
        <CaptionOptionGrid captions={CAPTIONS} selectedIndex={null} onSelect={vi.fn()} />
      </OverlayStackProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Read A in full/ }));
    const region = await screen.findByRole('region');
    await user.click(within(region).getByRole('button', { name: /Show English/ }));
    expect(await screen.findByRole('region')).toBeTruthy();
    expect(region.textContent).toContain('healing trip to Cebu');
  });
});


const DRAFT: PublishDraftState = {
  caption: KO, captionEn: KO_EN, mediaDataUrl: null, platforms: [], visibility: 'public',
  commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};

function renderComposer(onDraftChange = vi.fn(), draft = DRAFT) {
  render(
    <OverlayStackProvider>
      <PublishComposer
        draft={draft}
        onDraftChange={onDraftChange}
        audit={{ status: 'idle', step: 0, result: null }}
        platform="instagram"
      />
    </OverlayStackProvider>,
  );
  return onDraftChange;
}

describe('PublishComposer — edit in English, apply to the native caption', () => {
  it('has no toggle for an English caption', () => {
    renderComposer(vi.fn(), { ...DRAFT, caption: 'All English', captionEn: null });
    expect(screen.queryByRole('button', { name: /Show English/ })).toBeNull();
  });

  it('applies edited English by rewriting the native caption', async () => {
    localize.mockResolvedValue({
      caption: '세부에서 힐링해요 🌴 #세부여행', captionEn: 'Heal in Cebu 🌴 #세부여행 (Cebu trip)',
      targetLanguage: 'ko', source: 'groq',
    });
    const user = userEvent.setup();
    const onDraftChange = renderComposer();

    await user.click(screen.getByRole('button', { name: 'Show English' }));
    const box = screen.getByLabelText('Your caption (English translation)') as HTMLTextAreaElement;
    expect(box.value).toBe(KO_EN);
    expect(screen.getByRole('button', { name: 'Apply to Korean' })).toBeDisabled();

    await user.clear(box);
    await user.type(box, 'Heal in Cebu');
    await user.click(screen.getByRole('button', { name: 'Apply to Korean' }));

    await waitFor(() =>
      expect(onDraftChange).toHaveBeenCalledWith({
        caption: '세부에서 힐링해요 🌴 #세부여행',
        captionEn: 'Heal in Cebu 🌴 #세부여행 (Cebu trip)',
        agreementChecked: false,
      }),
    );
    expect(localize).toHaveBeenCalledWith(
      expect.objectContaining({ captionEn: 'Heal in Cebu', targetLanguage: 'ko', originalCaption: KO }),
    );
  });

  it('asks before leaving the English view with unapplied edits', async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(screen.getByRole('button', { name: 'Show English' }));
    await user.type(screen.getByLabelText('Your caption (English translation)'), ' more');

    await user.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.getByText(/You edited the English/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Discard edits' }));
    expect((screen.getByLabelText('Your caption') as HTMLTextAreaElement).value).toBe(KO);
    expect(localize).not.toHaveBeenCalled();
  });
});

describe('reconcilePost — translations go stale with the caption', () => {
  const base = { ...blankPost(emptyCampaign('Coastal & Island')), caption: KO, captionEn: KO_EN };

  it('clears captionEn when the caption changes without new English', () => {
    expect(reconcilePost(base, { ...base, caption: '다른 캡션' }).captionEn).toBeNull();
  });

  it('keeps captionEn when the caption and English change together (Apply)', () => {
    const next = reconcilePost(base, { ...base, caption: '다른 캡션', captionEn: 'Another caption' });
    expect(next.captionEn).toBe('Another caption');
  });

  it('keeps captionEn when only the English arrives', () => {
    const next = reconcilePost({ ...base, captionEn: null }, base);
    expect(next.captionEn).toBe(KO_EN);
  });
});
