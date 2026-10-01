interface ActionableScoreCardProps {
  title: string;
  score: number;
  variant: 'teal' | 'gold' | 'custom';
  color?: string;
  description?: string;
}

export default function ActionableScoreCard({
  title,
  score,
  variant,
  color,
  description,
}: ActionableScoreCardProps) {
  const valueColorClass =
    variant === 'teal'
      ? 'text-teal'
      : variant === 'gold'
      ? 'text-gold-dark'
      : '';

  return (
    <div
      className={`score-card ${variant} p-5 md:p-6 rounded-md bg-panel border border-line text-center shadow-1 flex flex-col justify-center items-center`}
    >
      <div
        className={`v num text-3xl md:text-4xl font-extrabold tracking-tight leading-none ${valueColorClass}`}
        style={color ? { color } : undefined}
      >
        {score}
      </div>
      <p className="eyebrow mt-2.5 text-muted">{title}</p>
      {description && (
        <p className="body-xs mt-2 text-muted max-w-prose">{description}</p>
      )}
    </div>
  );
}
