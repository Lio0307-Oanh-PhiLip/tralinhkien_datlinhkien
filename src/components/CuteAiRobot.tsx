import React from 'react';

interface CuteAiRobotProps {
  className?: string;
  size?: number | string;
  isAnimated?: boolean;
}

export const CuteAiRobot: React.FC<CuteAiRobotProps> = ({
  className = 'w-6 h-6',
  size,
  isAnimated = true,
}) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${isAnimated ? 'transition-transform duration-300' : ''}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="robotHeadGrad" x1="8" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="0.5" stopColor="#059669" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>

        <linearGradient id="screenGrad" x1="14" y1="18" x2="50" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#064E3B" />
          <stop offset="1" stopColor="#022C22" />
        </linearGradient>

        <linearGradient id="eyeGrad" x1="18" y1="26" x2="28" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>

        <linearGradient id="antennaGrad" x1="32" y1="2" x2="32" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>

        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Antenna */}
      <line x1="32" y1="12" x2="32" y2="6" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="4" fill="url(#antennaGrad)" filter="url(#glow)">
        {isAnimated && (
          <animate
            attributeName="opacity"
            values="0.8;1;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Ears / Side Bolts */}
      <rect x="4" y="24" width="4" height="12" rx="2" fill="#34D399" />
      <rect x="56" y="24" width="4" height="12" rx="2" fill="#34D399" />

      {/* Main Head Body */}
      <rect
        x="8"
        y="12"
        width="48"
        height="40"
        rx="14"
        fill="url(#robotHeadGrad)"
        stroke="#6EE7B7"
        strokeWidth="1.5"
      />

      {/* Dark Visor / Face Screen */}
      <rect
        x="13"
        y="18"
        width="38"
        height="26"
        rx="8"
        fill="url(#screenGrad)"
        stroke="#065F46"
        strokeWidth="1"
      />

      {/* Eyes (Left & Right) */}
      <ellipse cx="23" cy="29" rx="5" ry="5.5" fill="url(#eyeGrad)" filter="url(#glow)">
        {isAnimated && (
          <animate
            attributeName="ry"
            values="5.5;5.5;0.5;5.5;5.5"
            keyTimes="0;0.45;0.5;0.55;1"
            dur="4s"
            repeatCount="indefinite"
          />
        )}
      </ellipse>
      <circle cx="24.5" cy="27.5" r="1.5" fill="#FFFFFF" />

      <ellipse cx="41" cy="29" rx="5" ry="5.5" fill="url(#eyeGrad)" filter="url(#glow)">
        {isAnimated && (
          <animate
            attributeName="ry"
            values="5.5;5.5;0.5;5.5;5.5"
            keyTimes="0;0.45;0.5;0.55;1"
            dur="4s"
            repeatCount="indefinite"
          />
        )}
      </ellipse>
      <circle cx="42.5" cy="27.5" r="1.5" fill="#FFFFFF" />

      {/* Cute Cheeks */}
      <circle cx="17" cy="37" r="2" fill="#F472B6" opacity="0.6" />
      <circle cx="47" cy="37" r="2" fill="#F472B6" opacity="0.6" />

      {/* Friendly Smile */}
      <path
        d="M27 36 Q32 40 37 36"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Collar / Base */}
      <path d="M22 52 L42 52 L39 58 L25 58 Z" fill="#047857" />
    </svg>
  );
};
