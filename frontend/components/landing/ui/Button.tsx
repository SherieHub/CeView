/**
 * Landing-page button. Renders an <a> for in-page or external links, a router
 * <Link> for app routes (`to`), or a <button> otherwise — one look for all three.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost-on-dark' | 'link';
export type ButtonSize = 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  block?: boolean;
  /** Trailing arrow. Defaults on for `primary`. */
  arrow?: boolean;
  /** Leading play icon, for "watch" actions. */
  play?: boolean;
  className?: string;
  children: ReactNode;
}

type AsLink = CommonProps & { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>;
type AsAnchor = CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>;
type AsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export type ButtonProps = AsLink | AsAnchor | AsButton;

export default function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', block, arrow, play, className, children, ...rest } = props;
  const showArrow = arrow ?? variant === 'primary';
  const iconSize = size === 'lg' ? 18 : 17;
  const classes = `cv-btn cv-btn--${variant}${className ? ` ${className}` : ''}`;
  const data = { 'data-size': size, 'data-block': block || undefined };
  const content = (
    <>
      {play && <PlayCircle size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
      <span>{children}</span>
      {showArrow && <ArrowRight className="cv-btn-arrow" size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
    </>
  );

  if ('to' in rest) {
    const { to, ...anchor } = rest as Omit<AsLink, keyof CommonProps>;
    return (
      <Link to={to} className={classes} {...data} {...anchor}>
        {content}
      </Link>
    );
  }
  if ('href' in rest) {
    return (
      <a className={classes} {...data} {...(rest as Omit<AsAnchor, keyof CommonProps>)}>
        {content}
      </a>
    );
  }
  const { type = 'button', ...button } = rest as Omit<AsButton, keyof CommonProps>;
  return (
    <button type={type} className={classes} {...data} {...button}>
      {content}
    </button>
  );
}
