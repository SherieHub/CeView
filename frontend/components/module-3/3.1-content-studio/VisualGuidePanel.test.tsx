import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import VisualGuidePanel from './VisualGuidePanel';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import { SLIDE_COUNT, slidesFromCaption, slidesFromDirection, tipsFor } from './captionShots';
import { MOCK_CONTENT } from '../../../services/fixtures/content';
import { MOCK_CREATIVE_DIRECTION } from '../../../services/fixtures/creativeDirection';

const IG = MOCK_CONTENT.captions.instagram;

describe('slidesFromCaption', () => {
  it('builds four shots from the moments the caption names, in its order', () => {
    const slides = slidesFromCaption(IG.options[0], IG.guide, ['Sunset Cove Beach Resort', 'Sunset Cove']);
    expect(slides).toHaveLength(SLIDE_COUNT);
    expect(slides.map((s) => s.title)).toEqual([
      'The stay itself', // 호캉스
      'Inside the sardine run', // sardine run at sunrise
      'First light on the water', // sunrise
      'The slow, unplugged moment', // hammock by noon
    ]);
    expect(slides[1].quote).toMatch(/sardine run at sunrise/);
    expect(slides.every((s) => s.source === 'caption' && s.steps.length > 0)).toBe(true);
  });

  it('does not read the business name as a shot ("Sunset Cove" is not a sunset)', () => {
    const titles = slidesFromCaption('Sunset Cove Beach Resort — guided dives daily', [], ['Sunset Cove Beach Resort']).map((s) => s.title);
    expect(titles[0]).toBe('Your guide at work');
    expect(titles).not.toContain('First light on the water');
  });

  it('matches whole words, not letters inside other words', () => {
    // "beneath" contains "eat", "season" contains "sea".
    const titles = slidesFromCaption('A wall of silver turns beneath you this season').map((s) => s.title);
    expect(titles[0]).toBe('Inside the sardine run');
    expect(titles).not.toContain('At the table');
    expect(slidesFromCaption('Snorkeling all morning')[0].title).toBe('Reef from the surface');
  });

  it('also ignores the short form of the business name', () => {
    const titles = slidesFromCaption('Sunset Cove, Moalboal — guided dives daily', [], ['Sunset Cove Beach Resort']).map((s) => s.title);
    expect(titles).not.toContain('First light on the water');
    expect(titles[0]).toBe('Your guide at work');
  });

  it('gives a different caption different shots', () => {
    const a = slidesFromCaption('Fresh seafood breakfast by the temple').map((s) => s.title);
    const b = slidesFromCaption(IG.options[0]).map((s) => s.title);
    expect(a).not.toEqual(b);
    expect(a).toContain('At the table');
    expect(a).toContain('The landmark');
  });

  it('fills in with the platform’s AI guide lines when the caption names fewer moments', () => {
    const slides = slidesFromCaption('Book your Cebu food trip', IG.guide);
    expect(slides[0].title).toBe('At the table');
    expect(slides.slice(1).every((s) => s.source === 'guide')).toBe(true);
    expect(slides[1].steps[0]).toBe(IG.guide[0]);
  });

  it('ignores the hashtag block and returns nothing without a caption', () => {
    expect(slidesFromCaption('Hello\n\n#seafood #temple')[0]?.title).not.toBe('At the table');
    expect(slidesFromCaption('   ')).toEqual([]);
  });

  it('turns the AI shot list into slides', () => {
    const slides = slidesFromDirection(MOCK_CREATIVE_DIRECTION);
    expect(slides.length).toBe(Math.min(SLIDE_COUNT, MOCK_CREATIVE_DIRECTION.shots.length));
    expect(slides.every((s) => s.source === 'ai')).toBe(true);
    expect(slidesFromDirection(null)).toEqual([]);
  });

  it('has market tips, with a general fallback', () => {
    expect(tipsFor('Japan').length).toBeGreaterThan(0);
    expect(tipsFor('Atlantis').length).toBeGreaterThan(0);
  });
});

describe('VisualGuidePanel', () => {
  const slides = slidesFromCaption(IG.options[0], IG.guide, ['Sunset Cove Beach Resort', 'Sunset Cove']);

  it('shows one shot at a time, with the caption line it illustrates', async () => {
    const user = userEvent.setup();
    render(<OverlayStackProvider><VisualGuidePanel slides={slides} marketName="South Korea" onOpenGuide={vi.fn()} /></OverlayStackProvider>);
    const carousel = screen.getByRole('region', { name: 'Shots for your caption' });
    expect(within(carousel).getByRole('heading', { name: 'The stay itself' })).toBeInTheDocument();
    expect(within(carousel).getByText('Shot 1 of 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next shot' }));
    expect(within(carousel).getByRole('heading', { name: 'Inside the sardine run' })).toBeInTheDocument();
    expect(within(carousel).getByText(/sardine run at sunrise/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show shot 4/ }));
    expect(within(carousel).getByText('Shot 4 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next shot' }));
    expect(within(carousel).getByText('Shot 1 of 4')).toBeInTheDocument();
  });

  it('expands a shot to full size and pages through the rest there', async () => {
    const user = userEvent.setup();
    render(<OverlayStackProvider><VisualGuidePanel slides={slides} onOpenGuide={vi.fn()} /></OverlayStackProvider>);
    await user.click(screen.getByRole('button', { name: 'View The stay itself full size' }));

    const viewer = screen.getByRole('dialog', { name: 'The stay itself' });
    expect(within(viewer).getByRole('img')).toBeInTheDocument();
    expect(within(viewer).getByText('Shot 1 of 4')).toBeInTheDocument();
    expect(within(viewer).getByText(/^Example photo/)).toBeInTheDocument();

    await user.click(within(viewer).getByRole('button', { name: 'Next shot' }));
    expect(screen.getByRole('dialog', { name: 'Inside the sardine run' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The carousel followed along.
    expect(screen.getByText('Shot 2 of 4')).toBeInTheDocument();
  });

  it('opens on one generate action, then a loading state, before the shots', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    const { rerender } = render(
      <OverlayStackProvider><VisualGuidePanel slides={slides} state="idle" onGenerate={onGenerate} onOpenGuide={vi.fn()} /></OverlayStackProvider>,
    );
    expect(screen.queryByRole('region', { name: 'Shots for your caption' })).toBeNull();
    expect(screen.queryByRole('button', { name: /View full guide/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Generate AI shots' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);

    rerender(<OverlayStackProvider><VisualGuidePanel slides={slides} state="loading" onGenerate={onGenerate} onOpenGuide={vi.fn()} /></OverlayStackProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('Generating shots for your caption');
    expect(screen.queryByRole('button', { name: 'Generate AI shots' })).toBeNull();

    rerender(<OverlayStackProvider><VisualGuidePanel slides={slides} state="ready" onGenerate={onGenerate} onOpenGuide={vi.fn()} /></OverlayStackProvider>);
    expect(screen.getByRole('region', { name: 'Shots for your caption' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View full guide/ })).toBeInTheDocument();
  });

  it('asks for a caption when there is none', async () => {
    const user = userEvent.setup();
    const onChooseCaption = vi.fn();
    render(<OverlayStackProvider><VisualGuidePanel slides={[]} onOpenGuide={vi.fn()} onChooseCaption={onChooseCaption} /></OverlayStackProvider>);
    expect(screen.getByText('Choose a caption first')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Choose a caption/ }));
    expect(onChooseCaption).toHaveBeenCalled();
  });

  it('has no approve step of its own — the slides are the inspiration shots', async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();
    render(<OverlayStackProvider><VisualGuidePanel slides={slides} onOpenGuide={onOpenGuide} /></OverlayStackProvider>);
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /View full guide/ }));
    expect(onOpenGuide).toHaveBeenCalled();
  });

  it('hands over to the AI shots once they exist', () => {
    render(<OverlayStackProvider><VisualGuidePanel slides={slidesFromDirection(MOCK_CREATIVE_DIRECTION)} onOpenGuide={vi.fn()} /></OverlayStackProvider>);
    expect(screen.getAllByText('AI shot').length).toBeGreaterThan(0);
  });
});
