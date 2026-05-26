import React from 'react';
import { COLORS } from '../../../../constants';

const ScoreGauge: React.FC<{ score: number }> = ({ score }) => (
  <div className="relative w-48 h-24 overflow-hidden mb-4">
    <svg viewBox="0 0 100 50" className="w-full h-full transform">
      <defs>
        <linearGradient id="movingGradient" x1="0%" y1="0%" x2="200%" y2="0%">
          <stop offset="0%" stopColor={COLORS.NAVY} />
          <stop offset="16.66%" stopColor={COLORS.BLUE} />
          <stop offset="33.33%" stopColor={COLORS.SKYBLUE} />
          <stop offset="50%" stopColor={COLORS.NAVY} />
          <stop offset="66.66%" stopColor={COLORS.BLUE} />
          <stop offset="83.33%" stopColor={COLORS.SKYBLUE} />
          <stop offset="100%" stopColor={COLORS.WHITE} />
          <animate attributeName="x1" values="0%;-100%" dur="4s" repeatCount="indefinite" />
          <animate attributeName="x2" values="200%;100%" dur="4s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none" stroke="url(#movingGradient)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray="125.6" strokeDashoffset={125.6 - (125.6 * score)}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
    <div className="absolute bottom-0 left-0 w-full text-center">
      <span className="text-3xl font-black" style={{ color: COLORS.TEXT_MAIN }}>{score}</span>
    </div>
  </div>
);

export default ScoreGauge;
