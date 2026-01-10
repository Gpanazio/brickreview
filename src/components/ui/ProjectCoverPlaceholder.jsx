import React from 'react';

/**
 * Placeholder component for projects without a cover image.
 * Renders a stylized geometric pattern following the BRICK visual identity.
 * (Black, White, Red, Grayscale)
 */
export function ProjectCoverPlaceholder({ className, projectName = '', clientName = '' }) {
  // Generate a deterministic but pseudo-random variation based on project name
  const getVariation = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 3);
  };

  const variation = getVariation(projectName + clientName);

  return (
    <div className={`w-full h-full bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center ${className}`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        {variation === 0 && (
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}
        
        {variation === 1 && (
          <div className="w-full h-full flex flex-col justify-between">
             <div className="w-full h-1/3 bg-zinc-900 skew-y-12 scale-150 origin-top-left opacity-30"></div>
             <div className="w-full h-1/3 bg-zinc-800 -skew-y-12 scale-150 origin-bottom-right opacity-30"></div>
          </div>
        )}

        {variation === 2 && (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#333" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
        )}
      </div>

      {/* Red Accent Line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-red-600 opacity-80" />

      {/* Center Initial/Logo */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-zinc-800 flex items-center justify-center bg-black mb-2">
            <span className="brick-title text-xl text-zinc-500">
                {projectName ? projectName.charAt(0).toUpperCase() : 'B'}
            </span>
        </div>
        {/*
        <div className="h-[1px] w-8 bg-red-600 my-1"></div>
        <span className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest">
            {clientName ? clientName.substring(0, 8) : 'BRICK'}
        </span>
        */}
      </div>
      
      {/* Noise/Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
      ></div>
    </div>
  );
}
