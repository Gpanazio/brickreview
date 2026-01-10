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
      {/* Fallback Background (Solid Color) - Fail-safe */}
      <div className="absolute inset-0 bg-[#09090b]" />

      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        {variation === 0 && (
           <div className="w-full h-full" style={{ 
             backgroundImage: 'linear-gradient(45deg, #18181b 25%, transparent 25%, transparent 75%, #18181b 75%, #18181b), linear-gradient(45deg, #18181b 25%, transparent 25%, transparent 75%, #18181b 75%, #18181b)',
             backgroundSize: '10px 10px',
             backgroundPosition: '0 0, 5px 5px'
           }} />
        )}
        
        {variation === 1 && (
          <div className="w-full h-full" style={{
            background: 'radial-gradient(circle at center, #27272a 0%, #000000 100%)'
          }} />
        )}

        {variation === 2 && (
            <div className="w-full h-full" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #18181b 5px, #18181b 10px)'
            }} />
        )}
      </div>

      {/* Red Accent (Vertical Stripe) */}
      <div className="absolute top-0 left-0 w-[4px] h-full bg-[#dc2626] z-20" />

      {/* Content Container (Scale Down for Small Thumbnails) */}
      <div className="relative z-10 flex flex-col items-center justify-center transform scale-[0.6] md:scale-100 origin-center w-full">
        {/* Initial Box */}
        <div className="w-10 h-10 border-2 border-[#27272a] flex items-center justify-center bg-black shadow-lg">
            <span className="font-sans text-xl text-white font-black tracking-tighter" style={{ fontFamily: 'Inter, sans-serif' }}>
                {projectName ? projectName.charAt(0).toUpperCase() : 'B'}
            </span>
        </div>
        
        {/* Decorative Line */}
        <div className="h-[2px] w-6 bg-[#dc2626] my-1 opacity-80"></div>
        
        {/* Project Name (Truncated) */}
        {projectName.length > 0 && (
           <span className="font-mono text-[8px] text-[#71717a] uppercase tracking-widest font-bold max-w-[60px] truncate text-center" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
             {projectName.substring(0, 3).toUpperCase()}
           </span>
        )}
      </div>
      
      {/* Vignette Overlay (CSS fallback) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.6) 100%)' }} />

      {/* Noise/Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}
      ></div>
    </div>
  );
}
