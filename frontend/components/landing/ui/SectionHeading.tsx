/**
 * Eyebrow and the coral accent word, used by every landing section heading.
 *
 * Accent rule: at most one word or short phrase per heading.
 */
import type { ReactNode } from 'react';

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`cv-eyebrow${className ? ` ${className}` : ''}`}>{children}</p>;
}

/** The single coral italic word in a heading. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="accent">{children}</em>;
}
