/**
 * Small surfaces: Card, IconTile, Chip and the "Sample data" badge.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SAMPLE_LABELS } from '../../../content/landing';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`cv-card${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
}

/** A 48px round tile holding one icon. Decorative: pair it with visible text. */
export function IconTile({ icon: Icon, tone = 'teal', className }: { icon: LucideIcon; tone?: 'teal' | 'coral'; className?: string }) {
  return (
    <span className={`cv-icon-tile${className ? ` ${className}` : ''}`} data-tone={tone} aria-hidden="true">
      <Icon size={22} strokeWidth={1.75} />
    </span>
  );
}

export type ChipVariant = 'neutral' | 'teal' | 'coral' | 'dark';

export function Chip({
  variant = 'neutral',
  pill = false,
  className,
  children,
}: {
  variant?: ChipVariant;
  pill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`cv-chip${className ? ` ${className}` : ''}`} data-variant={variant} data-pill={pill || undefined}>
      {children}
    </span>
  );
}

/**
 * Required on every mock dashboard, chart, score or alert: the numbers are
 * not a real customer's.
 */
export function SampleBadge({ kind = 'sample', className }: { kind?: keyof typeof SAMPLE_LABELS; className?: string }) {
  return <span className={`cv-sample${className ? ` ${className}` : ''}`}>{SAMPLE_LABELS[kind]}</span>;
}
