import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useOptimisticMutation } from "../../hooks/useOptimisticMutation";
import { VideoProvider, useVideo } from "../../context/VideoContext";
import { VideoPlayerCore } from "./subcomponents/VideoPlayerCore";
import { ReviewCanvas } from "./subcomponents/ReviewCanvas";
import { CommentSidebar } from "./subcomponents/CommentSidebar";
import { Timeline } from "./subcomponents/Timeline";
import { VideoComparison } from "./VideoComparison";
import { formatTimecode, parseTimestampSeconds } from "../../utils/time";

const isMobile = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );
};
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  History,
  Download,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Columns2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VideoLoadingState } from "@/components/ui/VideoLoadingState";

const compareCommentsByTimestamp = (a, b) => {
  const aTs = parseTimestampSeconds(a?.timestamp);
  const bTs = parseTimestampSeconds(b?.timestamp);

  if (aTs === null && bTs === null) {
    return new Date(a.created_at) - new Date(b.created_at);
  }
  if (aTs === null) return 1;
  if (bTs === null) return -1;
  if (aTs !== bTs) return aTs - bTs;

  return new Date(a.created_at) - new Date(b.created_at);
};

export function VideoPlayer({ video, versions = [], ...props }) {
  // Determine initial version (latest)
  const getLatestVersion = useCallback(() => {
    if (versions.length === 0) return video;
    const sorted = [video, ...versions].sort((a, b) => b.version_number - a.version_number);
    return sorted[0];
  }, [video, versions]);

  const latestVersion = useMemo(() => getLatestVersion(), [getLatestVersion]);

  return (
    <VideoProvider
      initialVideo={latestVersion}
      versions={versions}
      isPublic={props.isPublic}
      shareToken={props.shareToken}
      sharePassword={props.sharePassword}
      initialVisitorName={props.visitorName}
    >
      <VideoPlayerContent video={video} versions={versions} {...props} />
    </VideoProvider>
  );
}

function VideoPlayerContent({
  video, // Main video object (parent)
  versions = [],
  onBack,
  isPublic = false,
  shareToken = null,
  sharePassword = null,
}) {
  const {
    currentVideo,
    setCurrentVideo,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    playbackRate,
    setPlaybackRate,
    isDrawingMode,
    setIsDrawingMode,
    videoUrl,
    setVideoUrl,
    isComparing,
    setIsComparing,
    compareVideoUrl,
    setCompareVideoUrl,
    playerRef,
    videoContainerRef,
    setComments,
  } = useVideo();

  // Derived state from context
  const currentVideoId = currentVideo.id;
  const playbackSpeed = playbackRate;

  // Local state
  const [approvalStatus, setApprovalStatus] = useState(
    currentVideo.latest_approval_status || "pending"
  );
  const [, setIsSubmittingApproval] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const [compareVersionId, setCompareVersionId] = useState(null);
  const [shareLink, setShareLink] = useState("");
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const [quality, setQuality] = useState(() => {
    if (isMobile()) return "proxy";
    const mime = currentVideo.mime_type || "";
    return mime.includes("mp4") || mime.includes("h264") ? "original" : "proxy";
  });
  const [, setIsLoadingVideo] = useState(false);

  const comparisonControllerRef = useRef(null);
  const compareSyncKeyRef = useRef(null);

  const { token } = useAuth();

  const isGuest = isPublic && !!shareToken;
  const canApprove = !isGuest && !!token;
  const canShare = !isGuest && !!token;
  const canDownload = true;

  const allVersions = useMemo(
    () => [video, ...versions].sort((a, b) => b.version_number - a.version_number),
    [video, versions]
  );
  const compareOptions = allVersions.filter((version) => version.id !== currentVideoId);

  useEffect(() => {
    if (!isComparing) return;
    if (compareVersionId && compareOptions.some((version) => version.id === compareVersionId))
      return;
    setCompareVersionId(compareOptions[0]?.id ?? null);
  }, [compareOptions, compareVersionId, isComparing]);

  useEffect(() => {
    if (isComparing) {
      setQuality("proxy");
      if (isDrawingMode) setIsDrawingMode(false);
    }
  }, [isComparing, isDrawingMode, setIsDrawingMode]);

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("Clipboard API falhou, tentando fallback", err);
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback de cópia falhou", err);
      return false;
    }
  };

  const videoFPS = currentVideo.fps || 30;
  const frameTime = 1 / videoFPS;

  const handleComparisonControllerReady = useCallback(
    (controller) => {
      comparisonControllerRef.current = controller;
      playerRef.current = controller ? { plyr: controller } : null;
    },
    [playerRef]
  );

  // Optimistic Approval - Status changes instantly
  const approvalMutation = useOptimisticMutation({
    mutationFn: async (data) => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: currentVideoId,
          status: data.status,
          notes: data.status === "approved"
            ? "Aprovado pelo cliente"
            : "Ajustes solicitados pelo cliente",
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao processar aprovação");
      }

      return response.json();
    },

    onMutate: (data) => {
      const previousStatus = approvalStatus;
      // Instant feedback - update status immediately
      setApprovalStatus(data.status);
      return { previousStatus };
    },

    onSuccess: () => {
      // Refresh history after successful approval
      fetchHistory();
    },

    onError: (_error, _data, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        setApprovalStatus(context.previousStatus);
      }
      console.error("Erro ao processar aprovação");
    },
  });

  const handleApproval = async (status) => {
    await approvalMutation.mutate({ status });
  };

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/reviews/${currentVideoId}`);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    }
  }, [currentVideoId, token]);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

  const handleVersionChange = (versionId) => {
    if (versionId === currentVideoId) return;

    setIsLoadingVideo(true);
    setVideoUrl(null); // Limpa URL atual para forçar loading

    // Resetar estado ao trocar versão (#9 fix)
    setComments([]);
    setDrawings([]);
    setCurrentTime(0);
    if (playerRef.current?.plyr) {
      playerRef.current.plyr.currentTime = 0;
    }

    // setCurrentVideoId(versionId); // Removed as it's derived
    const selectedVersion = allVersions.find((v) => v.id === versionId);
    if (selectedVersion) {
      setCurrentVideo(selectedVersion);
      setApprovalStatus(selectedVersion.latest_approval_status || "pending");

      const mime = selectedVersion.mime_type || "";
      setQuality(mime.includes("mp4") || mime.includes("h264") ? "original" : "proxy");
    }
  };

  const handleToggleCompare = () => {
    setIsComparing((prev) => !prev);
  };

  const handleCompareVersionChange = (versionId) => {
    if (versionId === compareVersionId) return;
    setCompareVersionId(versionId);
  };

  useEffect(() => {
    if (currentVideo?.duration) {
      setDuration(currentVideo.duration);
    }
  }, [currentVideo.duration, setDuration]);

  const fetchComments = useCallback(async () => {
    if (!currentVideoId) return;

    try {
      const endpoint = isGuest
        ? `/api/shares/${shareToken}/comments/video/${currentVideoId}`
        : `/api/comments/video/${currentVideoId}`;

      const headers = isGuest
        ? sharePassword
          ? { "x-share-password": sharePassword }
          : {}
        : {};

      const response = await fetch(endpoint, { headers });

      if (response.ok) {
        const data = await response.json();

        setComments((prevComments) => {
          if (prevComments.length !== data.length) {
            return [...data].sort(compareCommentsByTimestamp);
          }

          const isDifferent = JSON.stringify(prevComments) !== JSON.stringify(data);
          return isDifferent ? [...data].sort(compareCommentsByTimestamp) : prevComments;
        });
      }
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
    }
  }, [currentVideoId, token, isGuest, shareToken, sharePassword, setComments]);

  useEffect(() => {
    fetchComments();

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchComments();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [fetchComments]);

  const handleDownload = async (type) => {
    try {
      const headers = isGuest
        ? sharePassword
          ? { "x-share-password": sharePassword }
          : {}
        : {};

      const endpoint = isGuest
        ? `/api/shares/${shareToken}/video/${currentVideoId}/download?type=${type}`
        : `/api/videos/${currentVideoId}/download?type=${type}`;

      const response = await fetch(endpoint, { headers });

      if (response.ok) {
        const data = await response.json();

        const videoResponse = await fetch(data.url);
        const blob = await videoResponse.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = data.filename || `${currentVideo.title}_${type}.mp4`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    } catch (_error) {
      console.error("Erro ao fazer download");
    }
  };

  const handleGenerateShare = async () => {
    setIsGeneratingShare(true);
    const shareToast = toast.loading("Gerando link de compartilhamento...");

    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: currentVideoId,
          access_type: "comment",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao gerar link", { id: shareToast });
        return;
      }

      const data = await response.json();

      if (!data.token) {
        toast.error("Token de compartilhamento não recebido", { id: shareToast });
        return;
      }

      const fullUrl = `${window.location.origin}/share/${data.token}`;
      setShareLink(fullUrl);

      const copied = await copyToClipboard(fullUrl);

      if (copied) {
        toast.success("Link copiado!", {
          id: shareToast,
          description: "O link de revisão já está na sua área de transferência.",
        });
      } else {
        toast.dismiss(shareToast);
        setShowShareDialog(true);
      }
    } catch (error) {
      console.error("Erro ao gerar link:", error);
      toast.error("Erro ao gerar link de compartilhamento", { id: shareToast });
    } finally {
      setIsGeneratingShare(false);
    }
  };

  useEffect(() => {
    const fetchStreamUrl = async () => {
      try {
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/video/${currentVideoId}/stream?quality=${quality}`
          : `/api/videos/${currentVideoId}/stream?quality=${quality}`;

        const headers = isGuest
          ? sharePassword
            ? { "x-share-password": sharePassword }
            : {}
          : {};

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setVideoUrl(data.url);
          }
        }
      } catch (_) {
        // Silent error
      } finally {
        setIsLoadingVideo(false);
      }
    };

    if (currentVideoId) {
      setIsLoadingVideo(true);
      fetchStreamUrl();
    }
  }, [currentVideoId, isGuest, quality, sharePassword, shareToken, token, setVideoUrl]);

  useEffect(() => {
    if (!isComparing || !compareVersionId) {
      setCompareVideoUrl(null);
      return;
    }

    const fetchCompareStreamUrl = async () => {
      try {
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/video/${compareVersionId}/stream?quality=${quality}`
          : `/api/videos/${compareVersionId}/stream?quality=${quality}`;

        const headers = isGuest
          ? sharePassword
            ? { "x-share-password": sharePassword }
            : {}
          : {};

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setCompareVideoUrl(data.url);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar stream da versão comparada:", error);
      }
    };

    fetchCompareStreamUrl();
  }, [
    compareVersionId,
    isComparing,
    isGuest,
    quality,
    sharePassword,
    shareToken,
    token,
    setCompareVideoUrl,
  ]);

  useEffect(() => {
    if (!isComparing || !comparisonControllerRef.current || !videoUrl || !compareVideoUrl) return;
    const syncKey = `${videoUrl}|${compareVideoUrl}`;
    if (compareSyncKeyRef.current === syncKey) return;
    compareSyncKeyRef.current = syncKey;
    if (currentTime > 0) {
      comparisonControllerRef.current.currentTime = currentTime;
    }
  }, [compareVideoUrl, currentTime, isComparing, videoUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA";
      if (isInputFocused) return;

      const player = playerRef.current?.plyr;
      if (!player) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          isPlaying ? player.pause() : player.play();
          break;
        case "f":
        case "F":
          if (player.fullscreen) {
            player.fullscreen.exit();
          } else {
            player.fullscreen.enter();
          }
          break;
        case "j":
        case "J":
          e.preventDefault();
          if (isPlaying) {
            player.pause();
          }
          player.currentTime = Math.max(0, currentTime - 0.1);
          break;
        case "k":
        case "K":
          e.preventDefault();
          player.pause();
          break;
        case "l":
        case "L":
          e.preventDefault();
          if (!isPlaying) {
            player.play();
          }
          player.currentTime = Math.min(duration || 0, currentTime + 0.1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            player.currentTime = Math.max(0, currentTime - 1);
          } else {
            player.currentTime = Math.max(0, currentTime - frameTime);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            player.currentTime = Math.min(duration || 0, currentTime + 1);
          } else {
            player.currentTime = Math.min(duration || 0, currentTime + frameTime);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, currentTime, duration, frameTime, playerRef]);

  return (
    <>
      <div className="flex flex-col lg:flex-row h-full bg-[#050505] overflow-hidden min-h-0">
        <div className="relative z-10 flex flex-col flex-none lg:flex-1 min-w-0 max-h-[60vh] lg:max-h-none overflow-hidden">
          <div className="p-4 border-b border-zinc-800/50 glass-panel flex items-center gap-4">
            <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors cursor-pointer" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="brick-title text-lg tracking-tighter uppercase truncate">
              {currentVideo.title}
            </h2>

            <div className="flex items-center gap-2 ml-auto">
              {canApprove && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`rounded-none border px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-all ${approvalStatus === "approved"
                        ? "border-green-500/50 text-green-500 bg-green-500/10"
                        : "border-zinc-700 text-zinc-400 bg-zinc-900"
                        }`}
                    >
                      {approvalStatus === "approved" ? (
                        <CheckCircle className="w-3 h-3 mr-2" />
                      ) : (
                        <Clock className="w-3 h-3 mr-2" />
                      )}
                      {approvalStatus === "approved" ? "Aprovado" : "Em aprovação"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-48">
                    <DropdownMenuItem
                      onClick={() => handleApproval("approved")}
                      className="text-green-500 focus:text-green-400 focus:bg-green-500/10 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                    >
                      <CheckCircle className="w-3 h-3 mr-2" /> Marcar como Aprovado
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleApproval("pending")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                    >
                      <Clock className="w-3 h-3 mr-2" /> Voltar para Em aprovação
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className={`h-8 w-8 rounded-none border border-zinc-800 ${showHistory ? "bg-red-600 text-white border-red-600" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
                aria-label={showHistory ? "Hide history" : "Show history"}
              >
                <History className="w-4 h-4" />
              </Button>

              {canShare && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleGenerateShare}
                  disabled={isGeneratingShare}
                  className="h-8 w-8 rounded-none border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  aria-label="Share video"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              )}

              {canDownload && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800"
                      aria-label="Download options"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                    <DropdownMenuItem
                      onClick={() => handleDownload("proxy")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Baixar Proxy (720p)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDownload("original")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Baixar Original
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {allVersions.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleCompare}
                    className={`rounded-none border px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-all ${isComparing
                      ? "border-red-600 text-white bg-red-600"
                      : "border-zinc-800 text-zinc-400 bg-zinc-900 hover:bg-zinc-800"
                      }`}
                  >
                    <Columns2 className="w-3 h-3 mr-2" />
                    Comparar
                  </Button>

                  {isComparing && compareOptions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 h-8 flex items-center gap-2 rounded-none"
                        >
                          <History className="w-3 h-3" />v
                          {compareOptions.find((v) => v.id === compareVersionId)?.version_number ??
                            "--"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                        {compareOptions.map((v) => (
                          <DropdownMenuItem
                            key={v.id}
                            onClick={() => handleCompareVersionChange(v.id)}
                            className={`rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest ${v.id === compareVersionId
                              ? "text-red-500 bg-red-500/10"
                              : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                              }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>Versão {v.version_number}</span>
                              {v.id === compareVersionId && <CheckCircle className="w-3 h-3" />}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}

              {allVersions.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 h-8 flex items-center gap-2 rounded-none"
                    >
                      <History className="w-3 h-3" />v{currentVideo.version_number}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                    {allVersions.map((v) => (
                      <DropdownMenuItem
                        key={v.id}
                        onClick={() => handleVersionChange(v.id)}
                        className={`rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest ${v.id === currentVideoId
                          ? "text-red-500 bg-red-500/10"
                          : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                          }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>Versão {v.version_number}</span>
                          {v.id === currentVideoId && <CheckCircle className="w-3 h-3" />}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {allVersions.length === 1 && (
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-2 py-1.5 h-8 flex items-center">
                  v{currentVideo.version_number}
                </div>
              )}
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center min-h-0 overflow-hidden bg-black">
            <div
              ref={videoContainerRef}
              className={`relative w-full h-full flex items-center justify-center bg-black ${isDrawingMode ? "is-drawing" : ""}`}
            >
              {isComparing ? (
                videoUrl && compareVideoUrl ? (
                  <VideoComparison
                    masterSrc={videoUrl}
                    compareSrc={compareVideoUrl}
                    onControllerReady={handleComparisonControllerReady}
                    onTimeUpdate={setCurrentTime}
                    onDurationChange={setDuration}
                    onPlayStateChange={setIsPlaying}
                    onVolumeChange={(nextVolume, nextMuted) => {
                      setVolume(nextVolume);
                      setIsMuted(nextMuted);
                    }}
                    onRateChange={setPlaybackRate}
                  />
                ) : (
                  <VideoLoadingState message="A carregar comparação..." />
                )
              ) : videoUrl ? (
                <div
                  key={`player-${currentVideoId}-${videoUrl}`}
                  className="relative w-full h-full"
                >
                  <VideoPlayerCore />
                  <ReviewCanvas />
                </div>
              ) : (
                <VideoLoadingState message="A carregar stream..." />
              )}
            </div>
          </div>

          <div className="bg-[#0a0a0a] border-t border-zinc-800/50 flex flex-col relative z-30">
            <Timeline />

            <div className="flex items-center justify-between px-4 py-2 h-12">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!videoUrl) {
                      toast.error("Aguarde o vídeo carregar...");
                      return;
                    }
                    playerRef.current?.plyr?.togglePlay();
                  }}
                  disabled={!videoUrl}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none w-8 h-8 disabled:opacity-50"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest w-12 h-8 rounded-none"
                    >
                      {playbackSpeed}x
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    className="bg-zinc-950 border-zinc-800 rounded-none min-w-[60px]"
                  >
                    {[0.5, 1, 1.5, 2].map((speed) => (
                      <DropdownMenuItem
                        key={speed}
                        onClick={() => {
                          if (playerRef.current?.plyr) {
                            playerRef.current.plyr.speed = speed;
                          }
                        }}
                        className={`text-[10px] justify-center cursor-pointer font-bold ${playbackSpeed === speed
                          ? "text-red-500 bg-red-500/10"
                          : "text-zinc-500 focus:text-white focus:bg-zinc-800"
                          }`}
                      >
                        {speed}x
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-[10px] font-bold uppercase tracking-widest h-8 px-2 rounded-none ${quality === "original" ? "text-red-500" : "text-zinc-500 hover:text-white"
                        }`}
                    >
                      {quality === "original" ? "Original" : "720p"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    className="bg-zinc-950 border-zinc-800 rounded-none min-w-[100px]"
                  >
                    <DropdownMenuItem
                      onClick={() => setQuality("proxy")}
                      className={`text-[10px] cursor-pointer font-bold ${quality === "proxy"
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                        }`}
                    >
                      Auto (720p)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setQuality("original")}
                      className={`text-[10px] cursor-pointer font-bold ${quality === "original"
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                        }`}
                    >
                      Original (Máx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-4 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex h-7 w-7 lg:h-8 lg:w-8 rounded-none border border-zinc-800/50 text-zinc-500 hover:text-red-500 hover:border-red-600/50 transition-all bg-zinc-900/30"
                  onClick={() => {
                    if (playerRef.current?.plyr) playerRef.current.plyr.currentTime -= frameTime;
                  }}
                  aria-label="Previous frame"
                >
                  <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4" />
                </Button>

                <div className="flex flex-col items-center min-w-[80px] lg:min-w-[100px]">
                  <div className="brick-tech text-white font-bold text-sm lg:text-lg tabular-nums tracking-tight leading-none">
                    {formatTimecode(currentTime, videoFPS)}
                  </div>
                  <div className="text-[9px] text-zinc-600 font-medium uppercase tracking-widest mt-0.5">
                    {formatTimecode(duration, videoFPS)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="flex h-7 w-7 lg:h-8 lg:w-8 rounded-none border border-zinc-800/50 text-zinc-500 hover:text-red-500 hover:border-red-600/50 transition-all bg-zinc-900/30"
                  onClick={() => {
                    if (playerRef.current?.plyr) playerRef.current.plyr.currentTime += frameTime;
                  }}
                  aria-label="Next frame"
                >
                  <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center group relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (playerRef.current?.plyr) {
                        playerRef.current.plyr.muted = !isMuted;
                      }
                    }}
                    className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none w-8 h-8"
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                  <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 ease-out flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => {
                        if (playerRef.current?.plyr) {
                          playerRef.current.plyr.volume = parseFloat(e.target.value);
                        }
                      }}
                      className="w-16 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer ml-2 accent-red-600"
                    />
                  </div>
                </div>

                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => playerRef.current?.plyr?.fullscreen.toggle()}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none w-8 h-8"
                  aria-label="Toggle fullscreen"
                >
                  <Maximize className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <CommentSidebar
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          history={history}
        />

        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="bg-zinc-950 border-zinc-800 rounded-none sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="brick-title text-xl uppercase tracking-tighter text-white">
                Link de Revisão
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                Link de revisão criado, copie o link abaixo:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="bg-zinc-900 border-zinc-800 rounded-none text-xs text-zinc-300 focus:ring-red-600 h-10"
                  onClick={(e) => e.target.select()}
                />
                <Button
                  variant="ghost"
                  className="bg-red-600 hover:bg-red-700 text-white rounded-none h-10 px-4 text-[10px] font-black uppercase tracking-widest"
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    toast.success("Copiado!");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
