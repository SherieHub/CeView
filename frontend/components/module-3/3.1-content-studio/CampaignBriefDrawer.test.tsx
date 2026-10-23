import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import { slidesFromCaption } from './captionShots';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { MOCK_CONTENT } from '../../../services/fixtures/content';

const IG = MOCK_CONTENT.captions.instagram;
const SLIDES = slidesFromCaption(IG.options[0], IG.guide, ['Sunset Cove Beach Resort']);

function setup(props: Partial<Parameters<typeof CampaignBriefDrawer>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <OverlayStackProvider>
      <CampaignBriefDrawer open onClose={onClose} showWelcome={false} marketName="South Korea" slides={SLIDES} platformGuide={IG.guide} {...props} />
    </OverlayStackProvider>,
  );
  return { onClose, drawer: screen.getByRole('dialog', { name: 'Visual Guide' }) };
}

describe('CampaignBriefDrawer', () => {
  it('lays out the caption’s shots, the market tips and the platform direction', () => {
    const { drawer } = setup();
    expect(within(drawer).getByRole('heading', { name: 'Visual Guide for South Korea' })).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: 'Key tips for the South Korea market' })).toBeInTheDocument();
    for (const s of SLIDES) expect(within(drawer).getByRole('heading', { name: s.title })).toBeInTheDocument();
    expect(within(drawer).getByText(IG.guide[0])).toBeInTheDocument();
  });

  // The AI shot list section (approve & generate) was removed: the four shots
  // are where generated AI inspiration will appear.
  it('has no approve step and no separate AI shot list', () => {
    const { drawer } = setup();
    expect(within(drawer).queryByRole('button', { name: /approve/i })).toBeNull();
    expect(within(drawer).queryByText(/Your AI shot list/i)).toBeNull();
  });

  // Media guidance only. The drawer once also carried a moodboard and the
  // per-caption copywriting rationale; asserting their absence keeps that scope
  // from creeping back.
  it('carries no moodboard and no copywriting rationale', () => {
    setup();
    expect(screen.queryByText('Moodboard')).toBeNull();
    expect(screen.queryByText('Copywriting matrix')).toBeNull();
    expect(screen.queryByText('Business context')).toBeNull();
  });

  it('asks for a caption when there are no shots yet', () => {
    const { drawer } = setup({ slides: [] });
    expect(within(drawer).getByText(/Choose a caption in Draft/)).toBeInTheDocument();
  });

  it('shows the welcome note only when asked', () => {
    setup({ showWelcome: true });
    expect(screen.getByTestId('brief-welcome')).toBeTruthy();
  });

  it('closes on the drawer control', async () => {
    const { onClose, drawer } = setup();
    // The drawer's own Close — the shot viewer has one too once opened.
    await userEvent.click(within(drawer).getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
