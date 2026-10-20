/**
 * The staged media: an image, or — for video — a playable <video> whose poster
 * is the captured frame. One component so the composer, validate stage, full-size
 * modal and device preview all treat video the same way.
 */
interface MediaPreviewProps {
  /** The image, or the poster frame for a video. */
  src: string;
  /** Object URL for playback; present only for video. */
  videoSrc?: string | null;
  alt: string;
  className?: string;
}

export default function MediaPreview({ src, videoSrc, alt, className }: MediaPreviewProps) {
  if (videoSrc) {
    return (
      <video
        className={className}
        src={videoSrc}
        poster={src}
        controls
        muted
        playsInline
        aria-label={alt || 'Video preview'}
      />
    );
  }
  return <img className={className} src={src} alt={alt} />;
}
