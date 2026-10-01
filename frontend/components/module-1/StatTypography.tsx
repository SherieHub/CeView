interface StatTypographyProps {
  value: number;
  color?: string;
  sizeClass?: string;
}

export default function StatTypography({
  value,
  color,
  sizeClass = 'text-4xl',
}: StatTypographyProps) {
  return (
    <div className="flex items-baseline justify-center gap-1">
      <span
        className={`${sizeClass} font-extrabold tracking-tight num leading-none`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="text-sm font-semibold text-muted opacity-80">/100</span>
    </div>
  );
}
