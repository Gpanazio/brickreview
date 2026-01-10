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
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 opacity-15">
        {variation === 0 && (
          <div className="w-full h-full bg-[linear-gradient(45deg,#09090b_25%,transparent_25%,transparent_75%,#09090b_75%,#09090b),linear-gradient(45deg,#09090b_25%,transparent_25%,transparent_75%,#09090b_75%,#09090b)] bg-[length:10px_10px] bg-[position:0_0,5px_5px] bg-zinc-900/50" />
        )}
        
        {variation === 1 && (
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-950 to-zinc-950" />
        )}

        {variation === 2 && (
            <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#18181b_5px,#18181b_10px)]" />
        )}
      </div>

      {/* Red Accent (Vertical Stripe) */}
      <div className="absolute top-0 left-0 w-[4px] h-full bg-red-600/80 z-20" />

      {/* Content Container (Scale Down for Small Thumbnails) */}
      <div className="relative z-10 flex flex-col items-center justify-center transform scale-75 md:scale-100">
        {/* Initial Box */}
        <div className="w-10 h-10 md:w-12 md:h-12 border-2 border-zinc-800 flex items-center justify-center bg-black shadow-2xl">
            <span className="brick-title text-lg md:text-xl text-white font-black tracking-tighter">
                {projectName ? projectName.charAt(0).toUpperCase() : 'B'}
            </span>
        </div>
        
        {/* Decorative Line */}
        <div className="h-[2px] w-6 bg-red-600 my-1.5 opacity-50"></div>
        
        {/* Project Name (Truncated) */}
        {projectName.length > 0 && (
           <span className="brick-tech text-[6px] md:text-[8px] text-zinc-500 uppercase tracking-[0.2em] font-bold max-w-[80px] truncate text-center">
             {projectName.substring(0, 3).toUpperCase()}
           </span>
        )}
      </div>
      
      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />

      {/* Noise/Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
      ></div>
    </div>
  );
}
