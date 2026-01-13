import { useEffect, useRef, useState } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

const DRIFT_THRESHOLD = 0.05;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function VideoComparison({
  masterSrc,
  compareSrc,
  onControllerReady,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  onVolumeChange,
  onRateChange
}) {
  const containerRef = useRef(null);
  const masterRef = useRef(null);
  const compareRef = useRef(null);
  const rafRef = useRef(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const syncCurrentTime = () => {
    if (!masterRef.current || !compareRef.current) return;
    compareRef.current.currentTime = masterRef.current.currentTime;
  };

  const syncLoop = () => {
    if (!masterRef.current || !compareRef.current) return;
    const drift = Math.abs(masterRef.current.currentTime - compareRef.current.currentTime);
    if (drift > DRIFT_THRESHOLD) {
      compareRef.current.currentTime = masterRef.current.currentTime;
    }
    rafRef.current = requestAnimationFrame(syncLoop);
  };

  useEffect(() => {
    if (!masterRef.current || !compareRef.current) return;

    const master = masterRef.current;
    const compare = compareRef.current;

    const handlePlay = () => {
      compare.play().catch(() => {});
      onPlayStateChange?.(true);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(syncLoop);
    };

    const handlePause = () => {
      compare.pause();
      onPlayStateChange?.(false);
      cancelAnimationFrame(rafRef.current);
    };

    const handleSeeking = () => {
      syncCurrentTime();
    };

    const handleTimeUpdate = () => {
      onTimeUpdate?.(master.currentTime);
    };

    const handleDuration = () => {
      onDurationChange?.(master.duration);
    };

    const handleRateChange = () => {
      compare.playbackRate = master.playbackRate;
      onRateChange?.(master.playbackRate);
    };

    const handleVolumeChange = () => {
      compare.volume = master.volume;
      compare.muted = master.muted;
      onVolumeChange?.(master.volume, master.muted);
    };

    const handleLoadedMetadata = () => {
      syncCurrentTime();
      onDurationChange?.(master.duration);
    };

    master.addEventListener('play', handlePlay);
    master.addEventListener('pause', handlePause);
    master.addEventListener('seeking', handleSeeking);
    master.addEventListener('timeupdate', handleTimeUpdate);
    master.addEventListener('durationchange', handleDuration);
    master.addEventListener('ratechange', handleRateChange);
    master.addEventListener('volumechange', handleVolumeChange);
    master.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      master.removeEventListener('play', handlePlay);
      master.removeEventListener('pause', handlePause);
      master.removeEventListener('seeking', handleSeeking);
      master.removeEventListener('timeupdate', handleTimeUpdate);
      master.removeEventListener('durationchange', handleDuration);
      master.removeEventListener('ratechange', handleRateChange);
      master.removeEventListener('volumechange', handleVolumeChange);
      master.removeEventListener('loadedmetadata', handleLoadedMetadata);
      cancelAnimationFrame(rafRef.current);
    };
  }, [onDurationChange, onPlayStateChange, onRateChange, onTimeUpdate, onVolumeChange]);

  useEffect(() => {
    if (!masterRef.current || !compareRef.current) return;

    const controller = {
      media: masterRef.current,
      get currentTime() {
        return masterRef.current?.currentTime || 0;
      },
      set currentTime(value) {
        if (!masterRef.current || !compareRef.current) return;
        masterRef.current.currentTime = value;
        compareRef.current.currentTime = value;
      },
      get duration() {
        return masterRef.current?.duration || 0;
      },
      togglePlay() {
        if (!masterRef.current || !compareRef.current) return;
        if (masterRef.current.paused) {
          masterRef.current.play().catch(() => {});
          compareRef.current.play().catch(() => {});
        } else {
          masterRef.current.pause();
          compareRef.current.pause();
        }
      },
      play() {
        masterRef.current?.play().catch(() => {});
        compareRef.current?.play().catch(() => {});
      },
      pause() {
        masterRef.current?.pause();
        compareRef.current?.pause();
      },
      get speed() {
        return masterRef.current?.playbackRate || 1;
      },
      set speed(value) {
        if (!masterRef.current || !compareRef.current) return;
        masterRef.current.playbackRate = value;
        compareRef.current.playbackRate = value;
      },
      get volume() {
        return masterRef.current?.volume ?? 1;
      },
      set volume(value) {
        if (!masterRef.current || !compareRef.current) return;
        masterRef.current.volume = value;
        compareRef.current.volume = value;
      },
      get muted() {
        return masterRef.current?.muted ?? false;
      },
      set muted(value) {
        if (!masterRef.current || !compareRef.current) return;
        masterRef.current.muted = value;
        compareRef.current.muted = value;
      },
      fullscreen: {
        toggle: () => {
          const container = containerRef.current;
          if (!container) return;
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            container.requestFullscreen?.();
          }
        }
      }
    };

    onControllerReady?.(controller);

    return () => {
      onControllerReady?.(null);
    };
  }, [onControllerReady, masterSrc, compareSrc]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const percent = ((clientX - rect.left) / rect.width) * 100;
      setSliderPosition(clamp(percent, 0, 100));
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black">
      <video
        ref={masterRef}
        src={masterSrc}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        crossOrigin="anonymous"
      />

      <div
        className="absolute inset-0 overflow-hidden border-r-2 border-white/70"
        style={{ width: `${sliderPosition}%` }}
      >
        <video
          ref={compareRef}
          src={compareSrc}
          className="absolute inset-0 w-screen h-full object-contain max-w-none bg-black"
          playsInline
          crossOrigin="anonymous"
        />
      </div>

      <div
        className="absolute top-0 bottom-0 w-1 bg-red-600 cursor-col-resize z-50 flex items-center justify-center"
        style={{ left: `${sliderPosition}%` }}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      >
        <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <ChevronsLeftRight className="w-4 h-4 text-black" />
        </div>
      </div>
    </div>
  );
}
