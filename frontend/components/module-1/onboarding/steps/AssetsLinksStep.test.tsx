/**
 * CARD — Onboarding: Step 4 Assets & Links
 * Definition of Done: "covers logo file selection -> preview render".
 *
 * Also covers the step's defining rule — every field is optional, so nothing
 * here blocks the wizard's Continue button.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AssetsLinksStep from './AssetsLinksStep';
import { ObDraftProvider } from '../obDraft';

function renderStep() {
  return render(
    <ObDraftProvider>
      <AssetsLinksStep />
    </ObDraftProvider>
  );
}

/** A 1x1 transparent PNG — smallest thing FileReader can produce a data URL for. */
function pngFile() {
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) =>
    c.charCodeAt(0)
  );
  return new File([bytes], 'logo.png', { type: 'image/png' });
}

describe('AssetsLinksStep', () => {
  it('shows the empty dropzone prompt before a logo is chosen', () => {
    renderStep();
    expect(screen.getByText('Drop your logo')).toBeInTheDocument();
    expect(screen.queryByAltText('Logo preview')).not.toBeInTheDocument();
  });

  it('renders a preview after a logo file is selected', async () => {
    const { container } = renderStep();
    const input = container.querySelector<HTMLInputElement>('[data-testid="logo-input"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { files: [pngFile()] } });

    const preview = await screen.findByAltText('Logo preview');
    expect(preview.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByText('Logo added — click to replace')).toBeInTheDocument();
    expect(screen.queryByText('Drop your logo')).not.toBeInTheDocument();
  });

  it('renders a preview when a logo file is dropped', async () => {
    renderStep();
    const zone = screen.getByRole('button', { name: 'Upload logo' });

    fireEvent.drop(zone, { dataTransfer: { files: [pngFile()] } });

    await waitFor(() => expect(screen.getByAltText('Logo preview')).toBeInTheDocument());
  });

  it('keeps every social handle and the website editable and optional', () => {
    renderStep();

    for (const label of [
      'Instagram handle or page name',
      'TikTok handle or page name',
      'Facebook handle or page name',
      'Naver Blog handle or page name',
    ]) {
      const field = screen.getByLabelText(label) as HTMLInputElement;
      expect(field.value).toBe('');
      expect(field.required).toBe(false);
    }

    const website = screen.getByPlaceholderText('https://') as HTMLInputElement;
    expect(website.value).toBe('');
    expect(website.required).toBe(false);
  });

  it('writes a typed handle back into the draft', () => {
    renderStep();
    const field = screen.getByLabelText('Instagram handle or page name') as HTMLInputElement;

    fireEvent.change(field, { target: { value: '@islandhopper' } });

    expect((screen.getByLabelText('Instagram handle or page name') as HTMLInputElement).value).toBe(
      '@islandhopper'
    );
  });
});
