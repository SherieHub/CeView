interface OverallScoreCardProps {
  score: number;
}

export default function OverallScoreCard({ score }: OverallScoreCardProps) {
  return (
    <div className="score-card primary p-5 md:p-6 rounded-md bg-navy border border-navy text-white text-center shadow-2 flex flex-col justify-center items-center">
      <div className="v num text-4xl md:text-5xl font-extrabold tracking-tight text-gold leading-none">
        {score}
      </div>
      <p className="eyebrow mt-2.5 text-slate-300">Overall uniqueness</p>
    </div>
  );
}
