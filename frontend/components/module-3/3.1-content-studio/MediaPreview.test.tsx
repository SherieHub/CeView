import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MediaPreview from './MediaPreview';

describe('MediaPreview', () => {
  it('renders an image when there is no video source', () => {
    render(<MediaPreview src="data:image/png;base64,AAA" alt="Attached media" />);

    const img = screen.getByRole('img', { name: 'Attached media' });
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  it('renders a playable video with the poster frame when a video source is given', () => {
    const { container } = render(
      <MediaPreview src="data:image/jpeg;base64,POSTER" videoSrc="blob:video-1" alt="Attached media" />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('blob:video-1');
    expect(video?.getAttribute('poster')).toBe('data:image/jpeg;base64,POSTER');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('labels the video with its alt text, or a default when the alt is empty', () => {
    const { container, rerender } = render(<MediaPreview src="p" videoSrc="blob:v" alt="Attached media" />);
    expect(container.querySelector('video')?.getAttribute('aria-label')).toBe('Attached media');

    rerender(<MediaPreview src="p" videoSrc="blob:v" alt="" />);
    expect(container.querySelector('video')?.getAttribute('aria-label')).toBe('Video preview');
  });

  it('passes the class name through', () => {
    const { container } = render(<MediaPreview src="x" alt="" className="media-full" />);
    expect(container.querySelector('img')?.className).toBe('media-full');
  });
});
