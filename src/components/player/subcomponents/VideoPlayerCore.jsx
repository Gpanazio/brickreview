import { useEffect, useRef, useMemo } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
// import "../../VideoPlayer.css"; // Assuming style is needed, verify path
import { useVideo } from "../../../context/VideoContext";

const PLYR_OPTIONS = {
  controls: ["play-large"],
  keyboard: { focused: true, global: true },
  tooltips: { controls: true, seek: true },
  ratio: null,
  debug: false,
  blankVideo: "",
  fullscreen: {
    enabled: true,
    fallback: true,
    iosNative: true,
  },
  playsinline: true,
};

export function VideoPlayerCore() {
  const {
    playerRef,
    currentVideo,
    videoUrl,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setPlaybackRate,
    isComparing,
  } = useVideo();

  const elementRef = useRef(null);

  const videoSource = useMemo(() => {
    if (!videoUrl) return null;
    return {
      type: "video",
      preload: "auto",
      sources: [
        {
          src: videoUrl,
          type: currentVideo.mime_type || "video/mp4",
        },
      ],
    };
  }, [videoUrl, currentVideo.mime_type]);

  useEffect(() => {
    if (!videoUrl || !elementRef.current) return;

    // Initialize Plyr
    const player = new Plyr(elementRef.current, {
      ...PLYR_OPTIONS,
      previewThumbnails: currentVideo?.sprite_vtt_url
        ? { enabled: true, src: currentVideo.sprite_vtt_url }
        : { enabled: false },
      autoplay: false,
    });

    // Set source
    if (videoSource) {
      player.source = videoSource;
    }

    // Event Listeners
    player.on("play", () => setIsPlaying(true));
    player.on("pause", () => setIsPlaying(false));
    player.on("timeupdate", () => setCurrentTime(player.currentTime));
    player.on("durationchange", () => setDuration(player.duration));
    player.on("volumechange", () => {
      setVolume(player.volume);
      setIsMuted(player.muted);
    });
    player.on("ratechange", () => setPlaybackRate(player.speed));

    // Expose player instance to Context
    playerRef.current = { plyr: player };

    // Cleanup
    return () => {
      if (player) {
        player.destroy();
      }
      playerRef.current = null;
    };
  }, [
    videoUrl,
    videoSource,
    currentVideo,
    isComparing,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setIsMuted,
    setPlaybackRate,
    playerRef,
  ]);

  if (!videoUrl) {
    return (
      <div className="flex flex-col items-center gap-3 text-zinc-400 h-full w-full bg-black justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        <span className="text-xs font-bold uppercase tracking-[0.2em]">A carregar stream...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video ref={elementRef} className="plyr-react plyr" crossOrigin="anonymous" playsInline />
    </div>
  );
}
