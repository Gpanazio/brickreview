import { createContext, useContext, useState, useRef, useCallback, useMemo } from "react";

const VideoContext = createContext(null);

export const VideoProvider = ({
  children,
  initialVideo,
  versions = [],
  isPublic = false,
  shareToken = null,
  sharePassword = null,
  initialVisitorName = "",
}) => {
  const [currentVideo, setCurrentVideo] = useState(initialVideo);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const [comments, setComments] = useState(initialVideo.comments || []);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareVideoUrl, setCompareVideoUrl] = useState(null);
  const [visitorName, setVisitorName] = useState(initialVisitorName);
  const [drawings, setDrawings] = useState([]);
  const [activeRange, setActiveRange] = useState(null);

  const playerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoContainerRef = useRef(null);

  const seekTo = useCallback((time) => {
    if (playerRef.current?.plyr) {
      playerRef.current.plyr.currentTime = time;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (playerRef.current?.plyr) {
      playerRef.current.plyr.togglePlay();
    }
  }, []);

  const value = useMemo(() => ({
    currentVideo,
    setCurrentVideo,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isPlaying,
    setIsPlaying,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    isDrawingMode,
    setIsDrawingMode,
    selectedColor,
    setSelectedColor,
    comments,
    setComments,
    videoUrl,
    setVideoUrl,
    activeRange,
    setActiveRange,
    isComparing,
    setIsComparing,
    compareVideoUrl,
    setCompareVideoUrl,
    playerRef,
    canvasRef,
    videoContainerRef,
    seekTo,
    togglePlay,
    versions,
    // Guest/Share Context
    isPublic,
    shareToken,
    sharePassword,
    visitorName,
    setVisitorName,
    drawings,
    setDrawings,
  }), [
    currentVideo,
    currentTime,
    duration,
    isPlaying,
    isMuted,
    volume,
    playbackRate,
    isDrawingMode,
    selectedColor,
    comments,
    videoUrl,
    activeRange,
    isComparing,
    compareVideoUrl,
    visitorName,
    drawings,
    seekTo,
    togglePlay,
    versions,
    isPublic,
    shareToken,
    sharePassword
  ]);

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
};

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error("useVideo must be used within a VideoProvider");
  }
  return context;
};
