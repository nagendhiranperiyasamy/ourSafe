import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'light';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  tone = 'dark',
}) => {
  const iconDim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const textClass =
    size === 'sm'
      ? 'text-xl'
      : size === 'lg'
        ? 'text-3xl'
        : 'text-2xl';

  return (
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <div
        className={`${iconDim} rounded-xl flex items-center justify-center shrink-0 ${
          tone === 'light'
            ? 'bg-white/15 border border-white/25 text-white'
            : 'bg-[#2F4526] text-[#F5F8F1] shadow-sm shadow-[#182215]/15'
        }`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 28 28"
          fill="none"
          className="w-5 h-5"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 2.5L4.5 6.5V13.4C4.5 19.35 8.55 24.78 14 26.25C19.45 24.78 23.5 19.35 23.5 13.4V6.5L14 2.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 14.5H11.2L12.8 10.8L15.1 17.5L16.8 14.5H19.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        className={`font-semibold tracking-tight ${textClass} ${
          tone === 'light' ? 'text-white' : 'text-[#182215]'
        }`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        OurSafe
      </span>
    </div>
  );
};
