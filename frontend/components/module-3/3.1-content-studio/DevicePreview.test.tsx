import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DevicePreview from './DevicePreview';

const CAPTION = 'y'.repeat(400);

describe('DevicePreview', () => {
  it('applies the platform aspect ratio to the media', () => {
    const { container } = render(
      <DevicePreview platform="instagram" caption={CAPTION} mediaDataUrl="data:image/png;base64,x" />,
    );
    const media = container.querySelector('.device-media') as HTMLElement;
    expect(media.style.aspectRatio).toBe('4 / 5');
  });

  it('reformats when the platform changes', () => {
    const { container, rerender } = render(
      <DevicePreview platform="instagram" caption={CAPTION} mediaDataUrl="data:image/png;base64,x" />,
    );
    rerender(<DevicePreview platform="tiktok" caption={CAPTION} mediaDataUrl="data:image/png;base64,x" />);
    expect((container.querySelector('.device-media') as HTMLElement).style.aspectRatio).toBe('9 / 16');
    expect(container.querySelector('.device-frame')).toHaveAttribute('data-chrome', 'feed');
  });

  it('cuts the caption at the fold and offers more', () => {
    render(<DevicePreview platform="instagram" caption={CAPTION} mediaDataUrl={null} />);
    expect(screen.getByTestId('device-caption').textContent).toContain('y'.repeat(125));
    expect(screen.getByText('… more')).toBeTruthy();
  });

  it('shows a placeholder when no media is staged', () => {
    render(<DevicePreview platform="instagram" caption="hi" mediaDataUrl={null} />);
    expect(screen.getByTestId('device-media-empty')).toBeTruthy();
  });
});
