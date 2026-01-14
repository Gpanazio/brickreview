import { useEffect, useRef, useState } from "react";
import { useVideo } from "../../../context/VideoContext";
import { Play, Pause } from "lucide-react";

export function VideoPlayerCore() {
  const {
    playerRef,
    videoUrl,
    isPlaying,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setPlaybackRate,
  } = useVideo();

  const elementRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const prevVideoUrl = useRef(null);

  // Detect URL change for loading animation
  useEffect(() => {
    if (videoUrl && prevVideoUrl.current && videoUrl !== prevVideoUrl.current) {
      setIsLoading(true);
    }
    prevVideoUrl.current = videoUrl;
  }, [videoUrl]);

  useEffect(() => {
    if (!videoUrl || !elementRef.current) return;

    const video = elementRef.current;
    video.src = videoUrl;

    // Event Listeners on native video element
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleRateChange = () => setPlaybackRate(video.playbackRate);
    const handleLoadedData = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ratechange", handleRateChange);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);

    // Expose video element to Context (compatible with existing playerRef usage)
    playerRef.current = {
      plyr: {
        // Proxy methods to native video element
        play: () => video.play(),
        pause: () => video.pause(),
        togglePlay: () => (video.paused ? video.play() : video.pause()),
        get currentTime() { return video.currentTime; },
        set currentTime(val) { video.currentTime = val; },
        get duration() { return video.duration; },
        get volume() { return video.volume; },
        set volume(val) { video.volume = val; },
        get muted() { return video.muted; },
        set muted(val) { video.muted = val; },
        get speed() { return video.playbackRate; },
        set speed(val) { video.playbackRate = val; },
        fullscreen: {
          enter: () => video.requestFullscreen?.(),
          exit: () => document.exitFullscreen?.(),
        },
      },
    };

    // Cleanup
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("ratechange", handleRateChange);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      playerRef.current = null;
    };
  }, [
    videoUrl,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setIsMuted,
    setPlaybackRate,
    playerRef,
  ]);

  const handleTogglePlay = () => {
    if (elementRef.current) {
      if (elementRef.current.paused) {
        elementRef.current.play();
      } else {
        elementRef.current.pause();
      }
    }
  };

  if (!videoUrl) {
    return (
      <div className="flex flex-col items-center gap-3 text-zinc-400 h-full w-full bg-black justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        <span className="text-xs font-bold uppercase tracking-[0.2em]">A carregar stream...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black group/player">
      <video
        ref={elementRef}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
        preload="auto"
        onClick={handleTogglePlay}
      />

      {/* Loading overlay when switching quality */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 pointer-events-none">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-red-500 border-t-transparent" />
          <span className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">
            A carregar...
          </span>
        </div>
      )}

      {/* Big play/pause button in center */}
      {!isLoading && (
        <button
          onClick={handleTogglePlay}
          className={`absolute inset-0 flex items-center justify-center z-10 cursor-pointer bg-transparent transition-opacity duration-200 ${isPlaying ? "opacity-0 group-hover/player:opacity-100" : "opacity-100"
            }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <div className="w-20 h-20 rounded-full bg-black/60 flex items-center justify-center transition-all duration-300 hover:bg-black/80 hover:scale-110 shadow-2xl backdrop-blur-sm">
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white fill-white" />
            ) : (
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            )}
          </div>
        </button>
      )}
    </div>
  );
}

