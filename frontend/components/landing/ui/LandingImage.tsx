/**
 * The image component for landing photos (the Vite stand-in for next/image).
 * Reads files, size and alt text from content/image-credits.ts, serves AVIF
 * then WebP through <picture>, uses a responsive srcset when the credit has
 * one, and loads lazily unless `priority` (hero only).
 *
 * `fill` makes the image cover its positioned parent (object-fit: cover);
 * the parent sets the box, so the image can never cause layout shift.
 */
import type { CSSProperties } from 'react';
import { imageFor, type ImageSlot } from '../../../content/image-credits';

export default function LandingImage({
  slot,
  sizes = '100vw',
  priority = false,
  fill = false,
  decorative = false,
  className,
  style,
}: {
  slot: ImageSlot;
  /** Same meaning as the HTML `sizes` attribute. */
  sizes?: string;
  /** Load eagerly with high priority. Only the hero image should set this. */
  priority?: boolean;
  /** Cover the positioned parent. */
  fill?: boolean;
  /** Purely decorative: empty alt and role="presentation". */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const image = imageFor(slot);
  const classes = `cv-img${fill ? ' cv-img--fill' : ''}${className ? ` ${className}` : ''}`;
  const img = (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.srcSet ? sizes : undefined}
      alt={decorative ? '' : image.alt}
      role={decorative ? 'presentation' : undefined}
      width={image.width}
      height={image.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      className={classes}
      style={style}
    />
  );
  if (!image.avifSrcSet) return img;
  return (
    <picture className={fill ? 'cv-picture--fill' : undefined}>
      <source type="image/avif" srcSet={image.avifSrcSet} sizes={image.srcSet ? sizes : undefined} />
      {image.srcSet && <source type="image/webp" srcSet={image.srcSet} sizes={sizes} />}
      {img}
    </picture>
  );
}
