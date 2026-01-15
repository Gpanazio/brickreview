import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useVttThumbnails } from "../../hooks/useVttThumbnails";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import "./VideoPlayer.css";
import { useAuth } from "../../hooks/useAuth";

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
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  History,
  Reply,
  CornerDownRight,
  Download,
  Share2,
  Trash2,
  Pencil,
  Eraser,
  Smile,
  Paperclip,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Gauge,
  Columns2,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "emoji-picker-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VideoComparison } from "./VideoComparison";

const PLYR_OPTIONS = {
  controls: ["play-large"], // Mantém apenas o play central, os demais são customizados
  keyboard: { focused: true, global: true },
  tooltips: { controls: true, seek: true },
  ratio: null, // Desativa cálculo automático de aspect-ratio do Plyr
  debug: false, // Disable debug logs
  blankVideo: "", // Prevent blank video loading issues
  // Configurações críticas para Mobile Fullscreen:
  fullscreen: {
    enabled: true,
    fallback: true,
    iosNative: true, // Permite que o iOS use seu player nativo no Fullscreen (essencial para iPhone)
  },
  playsinline: true, // Permite tocar "inline" no mobile sem forçar fullscreen automaticamente no play
};

export function VideoPlayer({
  video,
  versions = [],
  onBack,
  isPublic = false,
  visitorName: initialVisitorName = "",
  shareToken = null,
  sharePassword = null,
  accessType: _accessType = "view",
}) {
  // Determina a versão inicial (mais recente) ao montar o componente
  const getLatestVersion = useCallback(() => {
    if (versions.length === 0) return video;
    // Encontra a versão com maior version_number
    const sorted = [video, ...versions].sort((a, b) => b.version_number - a.version_number);
    return sorted[0];
  }, [video, versions]);

  const latestVersion = useMemo(() => getLatestVersion(), [getLatestVersion]);

  const [currentVideoId, setCurrentVideoId] = useState(latestVersion.id);
  const [currentVideo, setCurrentVideo] = useState(latestVersion);
  const [comments, setComments] = useState(latestVersion.comments || []);
  const [newComment, setNewComment] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState(
    latestVersion.latest_approval_status || "pending"
  );
  const [, setIsSubmittingApproval] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "Confirmar ação",
    message: "Tem certeza que deseja continuar?",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "danger",
    onConfirm: null,
  });
  const [videoUrl, setVideoUrl] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState(null);
  const [compareVideoUrl, setCompareVideoUrl] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // ID do comentário sendo respondido
  const [replyText, setReplyText] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [visitorName, setVisitorName] = useState(
    initialVisitorName || localStorage.getItem("brickreview_visitor_name") || ""
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false); // Se está no modo desenho
  const [attachedFile, setAttachedFile] = useState(null);
  const [drawColor, setDrawColor] = useState("#FF0000");
  const [drawings, setDrawings] = useState([]); // Desenhos salvos por timestamp
  const [currentDrawing, setCurrentDrawing] = useState([]); // Pontos do desenho atual
  const [hasTimestamp, setHasTimestamp] = useState(true); // Se o comentário tem timestamp
  const [rangeEndTime, setRangeEndTime] = useState(null); // Fim do range (opcional)
  const [isRangeMode, setIsRangeMode] = useState(false); // Modo de seleção de range
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Controla exibição do emoji picker
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState(() => {
    if (isMobile()) return "proxy";
    const mime = latestVersion.mime_type || "";
    return mime.includes("mp4") || mime.includes("h264") ? "original" : "proxy";
  });
  const [duration, setDuration] = useState(latestVersion.duration || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [editingComment, setEditingComment] = useState(null);

  const [isLoadingVideo, setIsLoadingVideo] = useState(false); // Loading ao trocar versão
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  // Hover thumbnail states
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPos, setHoverPos] = useState(0);
  const thumbnails = useVttThumbnails(currentVideo?.sprite_vtt_url);

  const currentThumbnail = useMemo(() => {
    if (hoverTime === null || !thumbnails.length) return null;
    return thumbnails.find((t) => hoverTime >= t.start && hoverTime <= t.end) || thumbnails[0];
  }, [hoverTime, thumbnails]);

  const commentRefs = useRef({});

  useEffect(() => {
    if (highlightedCommentId && commentRefs.current[highlightedCommentId]) {
      commentRefs.current[highlightedCommentId].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      const timer = setTimeout(() => setHighlightedCommentId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedCommentId]);

  const playerRef = useRef(null);
  const comparisonControllerRef = useRef(null);
  const compareSyncKeyRef = useRef(null);
  const pendingSeekTimeRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoContainerRef = useRef(null);
  const { token } = useAuth();

  // Guest mode: no token, use visitor name for identification
  const isGuest = isPublic || !token;
  const canComment = true;
  const canApprove = !isGuest;

  const getGuestCommentIds = () => {
    try {
      const ids = localStorage.getItem("brickreview_guest_comment_ids");
      return ids ? JSON.parse(ids) : [];
    } catch (_) {
      return [];
    }
  };

  const addGuestCommentId = (id) => {
    const ids = getGuestCommentIds();
    localStorage.setItem("brickreview_guest_comment_ids", JSON.stringify([...ids, id]));
  };

  const removeGuestCommentId = (id) => {
    const ids = getGuestCommentIds().filter((savedId) => savedId !== id);
    localStorage.setItem("brickreview_guest_comment_ids", JSON.stringify(ids));
  };

  const canDeleteComment = (comment) => {
    if (!isGuest) return true;
    return getGuestCommentIds().includes(comment.id);
  };

  const canEditComment = (comment) => {
    if (!isGuest) return true;
    return getGuestCommentIds().includes(comment.id);
  };

  const canShare = !isGuest;
  const canDownload = true;

  // Pause video when entering drawing mode
  useEffect(() => {
    if (drawingMode && playerRef.current?.plyr) {
      playerRef.current.plyr.pause();
    }
  }, [drawingMode]);

  // Reset range mode when timestamp is toggled off
  useEffect(() => {
    if (!hasTimestamp) {
      setIsRangeMode(false);
      setRangeEndTime(null);
    }
  }, [hasTimestamp]);

  // Constrói lista completa de versões (vídeo original + versões)
  // Ordena da versão mais recente para a mais antiga
  const allVersions = [video, ...versions].sort((a, b) => b.version_number - a.version_number);
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
      if (drawingMode) setDrawingMode(false);
    }
  }, [isComparing, drawingMode]);

  // Helper para cópia robusta para clipboard
  const copyToClipboard = async (text) => {
    // Tenta API moderna
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("Clipboard API falhou, tentando fallback", err);
    }

    // Fallback para execCommand
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

  // Use precise FPS from metadata, fallback to 30 if not available
  const videoFPS = currentVideo.fps || 30;
  const frameTime = 1 / videoFPS;

  const videoSource = useMemo(() => {
    if (!videoUrl) return null;
    console.log("[VideoPlayer] Creating video source:", {
      url: videoUrl,
      mimeType: currentVideo.mime_type,
    });
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

  const parseTimestampSeconds = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const compareCommentsByTimestamp = (a, b) => {
    const aTs = parseTimestampSeconds(a?.timestamp);
    const bTs = parseTimestampSeconds(b?.timestamp);

    if (aTs === null && bTs === null) {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    if (aTs === null) return -1;
    if (bTs === null) return 1;
    if (aTs !== bTs) return aTs - bTs;

    return new Date(a.created_at) - new Date(b.created_at);
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Guests must provide a name
    if (isGuest && !visitorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    try {
      // Save visitor name to localStorage for future visits
      if (isGuest && visitorName.trim()) {
        localStorage.setItem("brickreview_visitor_name", visitorName.trim());
      }

      // Use different endpoint for guest comments
      const endpoint = isGuest ? `/api/shares/${shareToken}/comments` : "/api/comments";
      const headers = {
        "Content-Type": "application/json",
      };

      if (isGuest && sharePassword) {
        headers["x-share-password"] = sharePassword;
      }

      if (!isGuest) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const body = {
        video_id: currentVideoId,
        content: newComment,
        timestamp: hasTimestamp ? currentTime : null,
        timestamp_end: hasTimestamp && isRangeMode && rangeEndTime !== null ? rangeEndTime : null,
      };

      if (isGuest) {
        body.visitor_name = visitorName;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const comment = await response.json();
        if (isGuest) {
          addGuestCommentId(comment.id);
        }
        setComments((prev) => [...prev, comment].sort(compareCommentsByTimestamp));
        setNewComment("");
        setAttachedFile(null);
        setDrawingMode(false);
        setIsRangeMode(false);
        setRangeEndTime(null);
        toast.success("Comentário adicionado com sucesso!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao adicionar comentário");
      }
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    }
  };

  const addReply = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!replyText.trim() || !replyingTo) return;

    // Guests must provide a name
    if (isGuest && !visitorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    try {
      // Save visitor name to localStorage for future visits
      if (isGuest && visitorName.trim()) {
        localStorage.setItem("brickreview_visitor_name", visitorName.trim());
      }
      // Use different endpoint for guest replies
      const endpoint = isGuest ? `/api/shares/${shareToken}/comments` : "/api/comments";
      const headers = {
        "Content-Type": "application/json",
      };

      if (isGuest && sharePassword) {
        headers["x-share-password"] = sharePassword;
      }

      if (!isGuest) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const body = {
        video_id: currentVideoId,
        content: replyText,
        timestamp: currentTime,
        parent_comment_id: replyingTo,
      };

      if (isGuest) {
        body.visitor_name = visitorName;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const reply = await response.json();
        if (isGuest) {
          addGuestCommentId(reply.id);
        }
        setComments((prev) => [...prev, reply]);
        setReplyText("");
        setReplyingTo(null);
        setDrawingMode(false);
        toast.success("Resposta adicionada com sucesso!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao adicionar resposta");
      }
    } catch (error) {
      console.error("Erro ao adicionar resposta:", error);
      toast.error("Erro ao adicionar resposta");
    }
  };

  // Organiza comentários em threads (pais e respostas)
  const openConfirmDialog = ({
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = "danger",
    onConfirm,
  }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      variant,
      onConfirm,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const handleEditComment = async (commentId, newContent) => {
    const endpoint = isGuest
      ? `/api/shares/${shareToken}/comments/${commentId}`
      : `/api/comments/${commentId}`;

    const headers = {
      "Content-Type": "application/json",
    };

    if (isGuest && sharePassword) {
      headers["x-share-password"] = sharePassword;
    }

    if (!isGuest) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content: newContent }),
    });

    if (response.ok) {
      const updatedComment = await response.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updatedComment : c)));
      setEditingComment(null);
      toast.success("Comentário atualizado!");
    } else {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error || "Erro ao atualizar comentário");
    }
  };

  const handleDeleteComment = (commentId) => {
    openConfirmDialog({
      title: "Excluir comentário",
      message:
        "Tem certeza que deseja excluir este comentário? Respostas vinculadas também serão removidas.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
      onConfirm: async () => {
        const deleteToast = toast.loading("Excluindo comentário...");
        try {
          const endpoint = isGuest
            ? `/api/shares/${shareToken}/comments/${commentId}`
            : `/api/comments/${commentId}`;

          const headers = {
            "Content-Type": "application/json",
          };

          if (isGuest && sharePassword) {
            headers["x-share-password"] = sharePassword;
          }

          if (!isGuest) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const response = await fetch(endpoint, {
            method: "DELETE",
            headers,
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            toast.error(data.error || "Erro ao excluir comentário", { id: deleteToast });
            return;
          }

          if (isGuest) {
            removeGuestCommentId(commentId);
          }

          toast.success("Comentário excluído", { id: deleteToast });
          setComments((prev) =>
            prev.filter(
              (c) =>
                String(c.id) !== String(commentId) &&
                String(c.parent_comment_id) !== String(commentId)
            )
          );
          if (String(replyingTo) === String(commentId)) {
            setReplyingTo(null);
            setReplyText("");
          }
        } catch (error) {
          console.error("Erro ao excluir comentário:", error);
          toast.error("Erro ao excluir comentário", { id: deleteToast });
        }
      },
    });
  };

  const organizeComments = () => {
    const parentComments = comments.filter((c) => c.parent_comment_id == null);
    return parentComments.sort(compareCommentsByTimestamp).map((parent) => ({
      ...parent,
      replies: comments
        .filter(
          (c) => c.parent_comment_id != null && String(c.parent_comment_id) === String(parent.id)
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }));
  };

  const seekTo = (time) => {
    const targetTime = parseTimestampSeconds(time);
    if (targetTime === null) return;

    pendingSeekTimeRef.current = targetTime;

    const plyr = playerRef.current?.plyr;
    const media = plyr?.media;
    if (!plyr || !media) return;

    const applyPendingSeek = () => {
      const pending = pendingSeekTimeRef.current;
      if (!Number.isFinite(pending)) return;
      try {
        plyr.currentTime = pending;
        plyr.pause();
        pendingSeekTimeRef.current = null;
      } catch {
        // ignore; will retry on next media event
      }
    };

    // If media isn't ready yet, schedule a retry when metadata is available.
    if (typeof media.readyState === "number" && media.readyState < 1) {
      media.addEventListener("loadedmetadata", applyPendingSeek, { once: true });
      media.addEventListener("canplay", applyPendingSeek, { once: true });
      return;
    }

    applyPendingSeek();
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimecode = (seconds) => {
    const fpsInt = Math.max(1, Math.round(videoFPS || 30));
    const safeSeconds = Number(seconds);
    if (!Number.isFinite(safeSeconds) || safeSeconds < 0) return `0:00:00`;

    const totalFrames = Math.floor(safeSeconds * fpsInt);
    const mins = Math.floor(totalFrames / (fpsInt * 60));
    const secs = Math.floor(totalFrames / fpsInt) % 60;
    const frames = totalFrames % fpsInt;

    return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  const getCommentRange = (comment) => {
    const start = parseTimestampSeconds(comment.timestamp);
    const end = parseTimestampSeconds(comment.timestamp_end);
    if (start === null) return null;
    return { start, end };
  };

  const handleComparisonControllerReady = useCallback((controller) => {
    comparisonControllerRef.current = controller;
    playerRef.current = controller ? { plyr: controller } : null;
  }, []);

  const handleApproval = async (status) => {
    setIsSubmittingApproval(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          video_id: currentVideoId,
          status,
          notes:
            status === "approved" ? "Aprovado pelo cliente" : "Ajustes solicitados pelo cliente",
        }),
      });

      if (response.ok) {
        setApprovalStatus(status);
        fetchHistory();
      }
    } catch (error) {
      console.error("Erro ao processar aprovação:", error);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/reviews/${currentVideoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  // Função para trocar de versão
  const handleVersionChange = (versionId) => {
    if (versionId === currentVideoId) return;

    setIsLoadingVideo(true);
    setVideoUrl(null); // Limpa URL atual para forçar loading
    setCurrentVideoId(versionId);
    const selectedVersion = allVersions.find((v) => v.id === versionId);
    if (selectedVersion) {
      setCurrentVideo(selectedVersion);
      setApprovalStatus(selectedVersion.latest_approval_status || "pending");

      // Ajusta qualidade padrão para a nova versão
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

  // Carrega comentários quando a versão muda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentVideo?.duration) {
      setDuration(currentVideo.duration);
    }
    const fetchComments = async () => {
      try {
        // Use endpoint público para guests, privado para usuários autenticados
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/comments/video/${currentVideoId}`
          : `/api/comments/video/${currentVideoId}`;

        const headers = isGuest
          ? sharePassword
            ? { "x-share-password": sharePassword }
            : {}
          : { Authorization: `Bearer ${token}` };

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          setComments([...data].sort(compareCommentsByTimestamp));
        }
      } catch (error) {
        console.error("Erro ao carregar comentários:", error);
      }
    };

    fetchComments();
  }, [currentVideoId, token, isGuest, shareToken]);

  // Carrega desenhos quando a versão muda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchDrawings = async () => {
      try {
        // Use endpoint público para guests, privado para usuários autenticados
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/drawings/video/${currentVideoId}`
          : `/api/drawings/video/${currentVideoId}`;

        const headers = isGuest
          ? sharePassword
            ? { "x-share-password": sharePassword }
            : {}
          : { Authorization: `Bearer ${token}` };

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          // Converte os dados do banco para o formato esperado
          const formattedDrawings = data.map((d) => ({
            id: d.id,
            timestamp: parseFloat(d.timestamp),
            points: d.drawing_data,
            color: d.color,
          }));
          setDrawings(formattedDrawings);
        }
      } catch (error) {
        console.error("Erro ao carregar desenhos:", error);
      }
    };

    fetchDrawings();
  }, [currentVideoId, token, isGuest, shareToken]);

  // Função para fazer download do vídeo (proxy ou original)
  const handleDownload = async (type) => {
    try {
      const headers = isGuest
        ? sharePassword
          ? { "x-share-password": sharePassword }
          : {}
        : { Authorization: `Bearer ${token}` };

      const endpoint = isGuest
        ? `/api/shares/${shareToken}/video/${currentVideoId}/download?type=${type}`
        : `/api/videos/${currentVideoId}/download?type=${type}`;

      const response = await fetch(endpoint, { headers });

      if (response.ok) {
        const data = await response.json();

        // Força download usando fetch + blob ao invés de link direto
        const videoResponse = await fetch(data.url);
        const blob = await videoResponse.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = data.filename || `${currentVideo.title}_${type}.mp4`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    } catch (error) {
      console.error("Erro ao fazer download:", error);
    }
  };

  // Função para gerar link de compartilhamento do vídeo
  const handleGenerateShare = async () => {
    setIsGeneratingShare(true);
    const shareToast = toast.loading("Gerando link de compartilhamento...");

    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          video_id: currentVideoId,
          access_type: "comment", // Convidados podem comentar
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

      // Copia para clipboard usando o helper robusto
      const copied = await copyToClipboard(fullUrl);

      if (copied) {
        toast.success("Link copiado!", {
          id: shareToast,
          description: "O link de revisão já está na sua área de transferência.",
        });
      } else {
        // Se tudo falhar, abre o dialog customizado
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
        // Use endpoint público para guests, privado para usuários autenticados
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/video/${currentVideoId}/stream?quality=${quality}`
          : `/api/videos/${currentVideoId}/stream?quality=${quality}`;

        const headers = isGuest
          ? sharePassword
            ? { "x-share-password": sharePassword }
            : {}
          : { Authorization: `Bearer ${token}` };

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            // Se mudou o vídeo ou qualidade, salvamos o tempo atual
            // const savedTime = playerRef.current?.plyr?.currentTime || currentTime;
            setVideoUrl(data.url);

            // Após o loading (em outro useEffect), o plyr vai inicializar e podemos tentar dar seek
          }
        }
      } catch (_) {
        // Erro silencioso em produção
      } finally {
        setIsLoadingVideo(false);
      }
    };

    if (currentVideoId) {
      setIsLoadingVideo(true);
      fetchStreamUrl();
    }
  }, [currentVideoId, isGuest, quality, sharePassword, shareToken, token]);

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
          : { Authorization: `Bearer ${token}` };

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
  }, [compareVersionId, isComparing, isGuest, quality, sharePassword, shareToken, token]);

  useEffect(() => {
    if (!isComparing || !comparisonControllerRef.current || !videoUrl || !compareVideoUrl) return;
    const syncKey = `${videoUrl}|${compareVideoUrl}`;
    if (compareSyncKeyRef.current === syncKey) return;
    compareSyncKeyRef.current = syncKey;
    if (currentTime > 0) {
      comparisonControllerRef.current.currentTime = currentTime;
    }
  }, [compareVideoUrl, currentTime, isComparing, videoUrl]);

  // Inicializa o player Plyr nativo
  useEffect(() => {
    if (isComparing || !videoSource || !videoRef.current) return;

    const player = new Plyr(videoRef.current, {
      ...PLYR_OPTIONS,
      previewThumbnails: currentVideo?.sprite_vtt_url
        ? { enabled: true, src: currentVideo.sprite_vtt_url }
        : { enabled: false },
      autoplay: false,
    });

    // Define a fonte inicial
    player.source = videoSource;

    // Event Listeners para sincronizar estado
    player.on("play", () => setIsPlaying(true));
    player.on("pause", () => setIsPlaying(false));
    player.on("timeupdate", () => setCurrentTime(player.currentTime));
    player.on("durationchange", () => setDuration(player.duration));
    player.on("volumechange", () => {
      setVolume(player.volume);
      setIsMuted(player.muted);
    });
    player.on("ratechange", () => setPlaybackSpeed(player.speed));

    // Mantém compatibilidade com o resto do código que usa playerRef.current.plyr
    playerRef.current = { plyr: player };

    // Se temos um currentTime salvo (ex: trocou qualidade), busca esse tempo ao carregar
    // Se houver um seek pendente (ex: clique em comentário antes do player ficar pronto), aplica primeiro.
    player.on("ready", () => {
      const pendingSeekTime = pendingSeekTimeRef.current;
      if (Number.isFinite(pendingSeekTime)) {
        player.currentTime = pendingSeekTime;
        player.pause();
        pendingSeekTimeRef.current = null;
        return;
      }

      if (currentTime > 0.1) {
        player.currentTime = currentTime;
      }
    });

    // Cleanup ao desmontar ou trocar de fonte
    return () => {
      if (player) {
        player.destroy();
      }
      playerRef.current = null;
    };
  }, [currentVideo?.sprite_vtt_url, isComparing, videoSource]);

  // Polling para atualizar currentTime removido em favor de eventos nativos

  // Canvas drawing handlers
  const startDrawing = (e) => {
    if (!drawingMode) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentDrawing([{ x, y }]);
  };

  const draw = (e) => {
    if (!isDrawing || !drawingMode) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentDrawing([...currentDrawing, { x, y }]);
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentDrawing.length > 0) {
      // Salva o desenho localmente primeiro
      const newDrawing = {
        timestamp: currentTime,
        points: currentDrawing,
        color: drawColor,
        id: Date.now(),
      };
      setDrawings([...drawings, newDrawing]);

      // Salva no backend (apenas para usuários autenticados)
      if (!isGuest) {
        const saveToast = toast.loading("Salvando desenho...");
        try {
          const response = await fetch("/api/drawings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              video_id: currentVideoId,
              timestamp: currentTime,
              drawing_data: currentDrawing,
              color: drawColor,
            }),
          });

          if (response.ok) {
            toast.success("Desenho salvo com sucesso!", { id: saveToast });
            setCurrentDrawing([]);
            setDrawingMode(false); // Desativa modo desenho automaticamente
          } else {
            toast.error("Erro ao salvar desenho", { id: saveToast });
          }
        } catch (error) {
          console.error("Erro ao salvar desenho:", error);
          toast.error("Erro ao salvar desenho", { id: saveToast });
        }
      } else {
        setCurrentDrawing([]);
      }
    }
  };

  const clearDrawing = () => {
    setCurrentDrawing([]);
    setDrawings(drawings.filter((d) => Math.abs(d.timestamp - currentTime) > 0.1));
  };

  // Renderiza os desenhos no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const container = videoContainerRef.current;
    if (!container) return;

    // Ajusta o tamanho do canvas para o container
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha os desenhos salvos para o timestamp atual
    const currentDrawings = drawings.filter((d) => Math.abs(d.timestamp - currentTime) < 0.1);
    currentDrawings.forEach((drawing) => {
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      drawing.points.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    // Desenha o desenho atual (em progresso)
    if (currentDrawing.length > 0) {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      currentDrawing.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  }, [drawings, currentDrawing, currentTime, drawColor]);

  return (
    <>
      <div className="flex flex-col lg:flex-row h-full bg-[#050505] overflow-hidden min-h-0">
        {/* Área do Player */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <div className="p-4 border-b border-zinc-800/50 glass-panel flex items-center gap-4">
            <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="brick-title text-lg tracking-tighter uppercase truncate">
              {video.title}
            </h2>

            <div className="flex items-center gap-2 ml-auto">
              {/* Approval Button - Only for authenticated users */}
              {canApprove && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`rounded-none border px-3 h-8 text-xs font-black uppercase tracking-widest transition-all ${
                        approvalStatus === "approved"
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
                      className="text-green-500 focus:text-green-400 focus:bg-green-500/10 rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest"
                    >
                      <CheckCircle className="w-3 h-3 mr-2" /> Marcar como Aprovado
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleApproval("pending")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest"
                    >
                      <Clock className="w-3 h-3 mr-2" /> Voltar para Em aprovação
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleApproval("pending")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest"
                    >
                      <Clock className="w-3 h-3 mr-2" /> Voltar para Em aprovação
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* History Button - Available for all users */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className={`h-8 w-8 rounded-none border border-zinc-800 ${showHistory ? "bg-red-600 text-white border-red-600" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
              >
                <History className="w-4 h-4" />
              </Button>

              {/* Share Button - Only for authenticated users */}
              {canShare && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleGenerateShare}
                  disabled={isGeneratingShare}
                  className="h-8 w-8 rounded-none border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              )}

              {/* Download Menu - Only for authenticated users */}
              {canDownload && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                    <DropdownMenuItem
                      onClick={() => handleDownload("proxy")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Baixar Proxy (720p)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDownload("original")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Baixar Original
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDownload("original")}
                      className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Baixar Original
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Compare Button */}
              {allVersions.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleCompare}
                    className={`rounded-none border px-3 h-8 text-xs font-black uppercase tracking-widest transition-all ${
                      isComparing
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
                          className="text-xs font-bold text-zinc-300 uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 h-8 flex items-center gap-2 rounded-none"
                        >
                          <History className="w-3 h-3" />v
                          {compareOptions.find((opt) => opt.id === compareVersionId)?.version_number ??
                            "--"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                        {compareOptions.map((v) => (
                          <DropdownMenuItem
                            key={v.id}
                            onClick={() => handleCompareVersionChange(v.id)}
                            className={`rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest ${
                              v.id === compareVersionId
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

              {/* Version Selector */}
              {allVersions.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-bold text-zinc-300 uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 h-8 flex items-center gap-2 rounded-none"
                    >
                      <History className="w-3 h-3" />v{currentVideo.version_number}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                    {allVersions.map((v) => (
                      <DropdownMenuItem
                        key={v.id}
                        onClick={() => handleVersionChange(v.id)}
                        className={`rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest ${
                          v.id === currentVideoId
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

              {/* Version badge when only one version */}
              {allVersions.length === 1 && (
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-2 py-1.5 h-8 flex items-center">
                  v{currentVideo.version_number}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
            <div
              ref={videoContainerRef}
              className={`relative w-full h-full flex items-center justify-center bg-black ${drawingMode ? "is-drawing" : ""}`}
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
                    onRateChange={setPlaybackSpeed}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">
                      A carregar comparação...
                    </span>
                  </div>
                )
              ) : videoSource ? (
                <div
                  key={`player-${currentVideoId}-${videoUrl}`}
                  className="relative w-full h-full"
                >
                  <ContextMenu>
                    <ContextMenuTrigger className="w-full h-full">
                      <video
                        ref={videoRef}
                        className="plyr-react plyr"
                        crossOrigin="anonymous"
                        playsInline
                      />
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
                      <ContextMenuItem
                        onClick={() => handleDownload("original")}
                        className="focus:bg-red-600 focus:text-white cursor-pointer font-bold text-xs uppercase tracking-widest"
                      >
                        <Download className="w-3 h-3 mr-2" />
                        Baixar Original
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleDownload("proxy")}
                        className="focus:bg-red-600 focus:text-white cursor-pointer font-bold text-xs uppercase tracking-widest"
                      >
                        <Download className="w-3 h-3 mr-2" />
                        Baixar Proxy (720p)
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  {/* Canvas overlay for drawing */}
                  <canvas
                    ref={canvasRef}
                    className={`absolute top-0 left-0 w-full h-full pointer-events-none ${drawingMode ? "pointer-events-auto cursor-crosshair" : ""}`}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    style={{ zIndex: drawingMode ? 10 : 1 }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-400">
                  {/* Basic fallback */}
                </div>
              )}

              {/* Loading Overlay (Priority Z-50) */}
              {isLoadingVideo && (
                <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
                  <div className="flex gap-1 h-8">
                    <div
                      className="w-2 h-full bg-red-600 animate-[pulse_0.6s_ease-in-out_infinite]"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-full bg-red-600 animate-[pulse_0.6s_ease-in-out_infinite]"
                      style={{ animationDelay: "200ms" }}
                    />
                    <div
                      className="w-2 h-full bg-red-600 animate-[pulse_0.6s_ease-in-out_infinite]"
                      style={{ animationDelay: "400ms" }}
                    />
                  </div>
                </div>
              )}

              {/* Pause Overlay (Z-40) */}
              {!isPlaying && !isLoadingVideo && videoSource && !isComparing && !isDrawing && (
                <div className="absolute inset-0 z-40 bg-black/20 flex items-center justify-center pointer-events-none fade-in duration-300">
                  <div className="bg-black/90 backdrop-blur border border-zinc-800 p-6 flex flex-col items-center shadow-2xl">
                    <Pause className="w-8 h-8 text-white mb-2" />
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                      Pausado
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Controles Unificada (Frame.io style) */}
          <div className="bg-[#0a0a0a] border-t border-zinc-800/50 flex flex-col relative z-30">
            {/* Progress Scrubber */}
            <div
              className="w-full h-2 bg-zinc-900 cursor-pointer relative group"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const pos = x / rect.width;
                setHoverPos(x);
                setHoverTime(pos * (playerRef.current?.plyr?.duration || duration));
              }}
              onMouseLeave={() => setHoverTime(null)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                if (playerRef.current?.plyr) {
                  playerRef.current.plyr.currentTime =
                    pos * (playerRef.current.plyr.duration || duration);
                }
              }}
            >
              {/* Thumbnail Preview Tooltip */}
              {hoverTime !== null && !isMobile() && (
                <div
                  className="absolute bottom-full mb-4 z-[100] pointer-events-none -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${hoverPos}px` }}
                >
                  {currentThumbnail && (
                    <div
                      className="border-2 border-red-600 bg-black overflow-hidden shadow-2xl"
                      style={{
                        width: `${currentThumbnail.w}px`,
                        height: `${currentThumbnail.h}px`,
                        backgroundImage: `url(${currentThumbnail.url})`,
                        backgroundPosition: `-${currentThumbnail.x}px -${currentThumbnail.y}px`,
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                  )}
                  <div className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 mt-1 brick-tech">
                    {formatTimecode(hoverTime)}
                  </div>
                </div>
              )}

              {/* Buffered progress (opcional, se quiser implementar) */}
              <div
                className="absolute top-0 left-0 h-full bg-red-600"
                style={{
                  width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                }}
              />

              {/* Comment Markers */}
              {comments.map((comment) => {
                const ts = parseTimestampSeconds(comment.timestamp);
                if (ts === null || duration === 0) return null;
                const left = Math.min(100, (ts / duration) * 100);

                return (
                  <button
                    key={`marker-${comment.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(ts);
                      setHighlightedCommentId(comment.id);
                    }}
                    className="absolute top-0 w-1 h-full bg-white hover:bg-zinc-200 hover:w-1.5 z-30 transition-all cursor-pointer group/marker shadow-[0_0_2px_rgba(0,0,0,0.5)]"
                    style={{ left: `${left}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black border border-red-600 px-2 py-1 text-xs uppercase font-bold text-white opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {comment.username}
                    </div>
                  </button>
                );
              })}

              {/* Range Markers (rendered behind simple markers to avoid overlapping issues, or on top with different style) */}
              {comments.map((comment) => {
                const range = getCommentRange(comment);
                if (!range || range.end === null || duration === 0) return null;

                const startPct = Math.min(100, Math.max(0, (range.start / duration) * 100));
                const endPct = Math.min(100, Math.max(0, (range.end / duration) * 100));
                const width = Math.max(0.5, endPct - startPct); // Mínimo visual

                return (
                  <div
                    key={`range-${comment.id}`}
                    className="absolute top-0 h-full bg-red-600/40 border-l border-r border-white/60 z-0 pointer-events-none"
                    style={{ left: `${startPct}%`, width: `${width}%` }}
                  />
                );
              })}

              {/* Current Range Selection Preview */}
              {isRangeMode && hasTimestamp && rangeEndTime !== null && duration > 0 && (
                <div
                  className="absolute top-0 h-full bg-white/30 border-l border-r border-white/80 z-20 pointer-events-none"
                  style={{
                    left: `${Math.min((currentTime / duration) * 100, (rangeEndTime / duration) * 100)}%`,
                    width: `${Math.abs(((rangeEndTime - currentTime) / duration) * 100)}%`,
                  }}
                />
              )}

              {/* Scrubber Handle on Hover */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  left: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                }}
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between px-4 py-2 h-12">
              {/* Left Controls: Play & Speed */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => playerRef.current?.plyr?.togglePlay()}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none w-8 h-8"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </Button>

                {/* Speed Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest w-12 h-8 rounded-none"
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
                        className={`text-xs justify-center cursor-pointer font-bold ${
                          playbackSpeed === speed
                            ? "text-red-500 bg-red-500/10"
                            : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                        }`}
                      >
                        {speed}x
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

                {/* Quality Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs font-bold uppercase tracking-widest h-8 px-2 rounded-none ${
                        quality === "original" ? "text-red-500" : "text-zinc-500 hover:text-white"
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
                      className={`text-xs cursor-pointer font-bold ${
                        quality === "proxy"
                          ? "text-red-500 bg-red-500/10"
                          : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                      }`}
                    >
                      Auto (720p)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setQuality("original")}
                      className={`rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest ${
                        quality === "original"
                          ? "text-red-500 bg-red-500/10"
                          : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                      }`}
                    >
                      Original (Máx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Center Controls: Frame & Timecode */}
              <div className="flex items-center gap-4 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:flex h-8 w-8 rounded-none border border-zinc-800/50 text-zinc-500 hover:text-red-500 hover:border-red-600/50 transition-all bg-zinc-900/30"
                  onClick={() => {
                    if (playerRef.current?.plyr) playerRef.current.plyr.currentTime -= frameTime;
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex flex-col items-center min-w-[80px] lg:min-w-[100px]">
                  <div className="brick-tech text-white font-bold text-sm lg:text-lg tabular-nums tracking-tight leading-none">
                    {formatTimecode(currentTime)}
                  </div>
                  <div className="text-xs text-zinc-600 font-medium uppercase tracking-widest mt-0.5">
                    {formatTimecode(duration)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:flex h-8 w-8 rounded-none border border-zinc-800/50 text-zinc-500 hover:text-red-500 hover:border-red-600/50 transition-all bg-zinc-900/30"
                  onClick={() => {
                    if (playerRef.current?.plyr) playerRef.current.plyr.currentTime += frameTime;
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Right Controls: Volume & Fullscreen */}
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
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                  {/* Volume Slider on Hover (Simple implementation) */}
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
                >
                  <Maximize className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Lateral de Comentários / Histórico */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-800/50 glass-panel flex flex-col relative z-20 h-auto min-h-0 lg:h-full flex-1 lg:flex-none overflow-hidden">
          <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
            <h3 className="brick-title text-sm uppercase tracking-widest flex items-center gap-2 text-white">
              {showHistory ? (
                <>
                  <History className="w-4 h-4 text-red-600" /> Histórico
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 text-red-600" /> Comentários ({comments.length})
                </>
              )}
            </h3>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-black uppercase tracking-tighter text-zinc-500 hover:text-white transition-colors"
            >
              {showHistory ? "Ver Comentários" : "Ver Histórico"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-0">
            {showHistory ? (
              history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
                  Nenhum histórico registrado ainda.
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="glass-card p-4 border-l-2 border-l-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          item.status === "approved" ? "bg-green-500" : "bg-zinc-500"
                        }`}
                      />
                      <span
                        className={`text-xs font-black uppercase tracking-widest ${
                          item.status === "approved" ? "text-green-500" : "text-zinc-400"
                        }`}
                      >
                        {item.status === "approved" ? "Aprovado" : "Em aprovação"}
                      </span>
                    </div>
                    <p className="text-xs text-white font-medium mb-1">{item.notes}</p>
                    <div className="flex items-center justify-between text-xs text-zinc-500 uppercase font-bold tracking-widest">
                      <span>{item.username}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
                Nenhum comentário ainda. Vá para um frame específico e comece a discussão.
              </div>
            ) : (
              organizeComments().map((comment, index, all) => {
                const isGeneral = parseTimestampSeconds(comment.timestamp) === null;
                const isFirstGeneral = isGeneral && index === 0;
                const isFirstTimed =
                  !isGeneral &&
                  (index === 0 || parseTimestampSeconds(all[index - 1]?.timestamp) === null);

                return (
                  <div key={comment.id} className="space-y-4">
                    {isFirstGeneral && (
                      <div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">
                        <div className="w-1.5 h-1.5 bg-red-600" />
                        Feedback Geral
                      </div>
                    )}
                    {isFirstTimed && (
                      <div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mt-6 mb-2">
                        <Clock className="w-3 h-3" />
                        Review Timeline
                      </div>
                    )}

                    <div className="space-y-2">
                      {/* Comentário Principal */}
                      <div
                        ref={(el) => (commentRefs.current[comment.id] = el)}
                        className={`group glass-card p-3 border-l-2 transition-all cursor-pointer duration-300 ${
                          highlightedCommentId === comment.id
                            ? "border-l-red-600 bg-red-600/10 shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]"
                            : isGeneral
                              ? "border-l-red-600 bg-red-600/5 shadow-[inset_0_0_20px_rgba(220,38,38,0.05)]"
                              : "border-l-transparent hover:border-l-red-600"
                        }`}
                        onClick={(e) => {
                          const target = e.target;
                          if (target?.closest?.("[data-comment-actions]")) return;
                          if (target?.closest?.("button, a, input, textarea, form, label")) return;

                          const ts = parseTimestampSeconds(comment.timestamp);
                          // const endTs = parseTimestampSeconds(comment.timestamp_end); // Reserved for future use

                          if (ts !== null) {
                            seekTo(ts);
                            // Opcional: se tiver range, poderia tocar o range ou dar highlight
                          }
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs font-black uppercase tracking-tighter ${isGeneral ? "text-zinc-400" : "text-red-600"}`}
                            >
                              {parseTimestampSeconds(comment.timestamp) !== null
                                ? comment.timestamp_end
                                  ? `${formatTime(parseTimestampSeconds(comment.timestamp))} - ${formatTime(parseTimestampSeconds(comment.timestamp_end))}`
                                  : formatTime(parseTimestampSeconds(comment.timestamp))
                                : "GERAL / PINS"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                {comment.username}
                              </span>
                              {(canEditComment(comment) || canDeleteComment(comment)) && (
                                <div className="flex items-center gap-1">
                                  {canEditComment(comment) && (
                                    <button
                                      type="button"
                                      data-comment-actions
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingComment(
                                          editingComment === comment.id ? null : comment.id
                                        );
                                      }}
                                      className="text-zinc-600 hover:text-blue-500 transition-colors"
                                      title="Editar comentário"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canDeleteComment(comment) && (
                                    <button
                                      type="button"
                                      data-comment-actions
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteComment(comment.id);
                                      }}
                                      className="text-zinc-600 hover:text-red-500 transition-colors"
                                      title="Excluir comentário"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {editingComment === comment.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const editContent = e.target.elements.editContent.value;
                                if (editContent.trim()) {
                                  handleEditComment(comment.id, editContent.trim());
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2"
                            >
                              <textarea
                                name="editContent"
                                defaultValue={comment.content}
                                autoFocus
                                rows={3}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="submit"
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest py-2 transition-colors"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingComment(null);
                                  }}
                                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-black uppercase tracking-widest py-2 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <p className="text-sm text-zinc-300 leading-relaxed">
                              {comment.content}
                            </p>
                          )}
                        </div>

                        {/* Botão de Responder - disponível para todos */}
                        {canComment && (
                          <div data-comment-actions onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                              }}
                              className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                            >
                              <Reply className="w-3 h-3" />
                              {replyingTo === comment.id ? "Cancelar" : "Responder"}
                            </button>

                            {replyingTo === comment.id && (
                              <form
                                onSubmit={addReply}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-3 space-y-2"
                              >
                                {/* Guest name input for replies */}
                                {isGuest && canComment && (
                                  <input
                                    type="text"
                                    value={visitorName}
                                    onChange={(e) => setVisitorName(e.target.value)}
                                    placeholder="Seu nome"
                                    className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                                    required={isGuest}
                                  />
                                )}
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onFocus={() => {
                                    if (drawingMode) setDrawingMode(false);
                                  }}
                                  placeholder="Escreva sua resposta..."
                                  className="w-full bg-[#0a0a0a] border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-16"
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  disabled={!replyText.trim()}
                                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-black uppercase tracking-widest py-2 transition-colors"
                                >
                                  Enviar Resposta
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Respostas */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-4 space-y-2 border-l-2 border-zinc-800/50 pl-3">
                          {comment.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="glass-card p-3 bg-zinc-900/30"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <CornerDownRight className="w-3 h-3 text-zinc-600" />
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                  {reply.username}
                                </span>

                                <div className="ml-auto flex items-center gap-2">
                                  <span className="text-xs text-zinc-600">
                                    {new Date(reply.created_at).toLocaleString("pt-BR", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {(canEditComment(reply) || canDeleteComment(reply)) && (
                                    <div className="flex items-center gap-1">
                                      {canEditComment(reply) && (
                                        <button
                                          type="button"
                                          data-comment-actions
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingComment(
                                              editingComment === reply.id ? null : reply.id
                                            );
                                          }}
                                          className="text-zinc-600 hover:text-blue-500 transition-colors"
                                          title="Editar comentário"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      )}
                                      {canDeleteComment(reply) && (
                                        <button
                                          type="button"
                                          data-comment-actions
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteComment(reply.id);
                                          }}
                                          className="text-zinc-600 hover:text-red-500 transition-colors"
                                          title="Excluir comentário"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {editingComment === reply.id ? (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const editContent = e.target.elements.editContent.value;
                                    if (editContent.trim()) {
                                      handleEditComment(reply.id, editContent.trim());
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-2"
                                >
                                  <textarea
                                    name="editContent"
                                    defaultValue={reply.content}
                                    autoFocus
                                    rows={2}
                                    className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      type="submit"
                                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest py-2 transition-colors"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingComment(null);
                                      }}
                                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-black uppercase tracking-widest py-2 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                  {reply.content}
                                </p>
                              )}

                              {/* Botão de responder também nas respostas */}
                              {canComment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                    setReplyText(`@${reply.username} `);
                                  }}
                                  className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
                                >
                                  <Reply className="w-3 h-3" />
                                  Responder
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input de Novo Comentário */}
          {!showHistory && (
            <div className="p-4 border-t border-zinc-800/50 bg-white/5">
              <form onSubmit={addComment} className="flex flex-col gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                  {hasTimestamp ? (
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-red-500">{formatTimecode(currentTime)}</span>
                      {isRangeMode && (
                        <>
                          <span className="text-zinc-600 mx-1">à</span>
                          <span
                            className={`cursor-pointer hover:text-white ${rangeEndTime !== null ? "text-red-500" : "text-zinc-500"}`}
                            onClick={() => {
                              // Se clicar no tempo final, ele reseta ou foca
                              if (rangeEndTime !== null) {
                                seekTo(rangeEndTime);
                              }
                            }}
                          >
                            {rangeEndTime !== null ? formatTimecode(rangeEndTime) : "--:--:--"}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-zinc-500">Comentário geral (sem timestamp)</div>
                  )}
                  <span className="text-zinc-600">Deixe seu comentário...</span>
                </div>

                {/* Guest name input - discreto e inline */}
                {isGuest && canComment && (
                  <input
                    type="text"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                    required={isGuest}
                  />
                )}

                <div className="relative">
                  {attachedFile && (
                    <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-2 py-1">
                      <Paperclip className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-zinc-300 truncate max-w-[150px]">
                        {attachedFile.name}
                      </span>
                      <button
                        onClick={() => setAttachedFile(null)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onFocus={() => {
                      // Fecha o modo desenho ao focar no campo de texto para limpar a UI
                      if (drawingMode) setDrawingMode(false);
                    }}
                    placeholder={isGuest ? "Escreva seu comentário..." : "Escreva seu feedback..."}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 p-3 pb-12 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-24"
                    disabled={isGuest && !canComment}
                  />

                  {/* Toolbar de ações */}
                  <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-[#0a0a0a] p-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {/* Timestamp Toggle */}
                      <button
                        type="button"
                        className={`p-2 rounded-sm transition-colors ${
                          hasTimestamp
                            ? "text-red-500 bg-red-500/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                        onClick={() => setHasTimestamp(!hasTimestamp)}
                        title={hasTimestamp ? "Remover timestamp" : "Vincular ao tempo atual"}
                      >
                        <Clock className="w-4 h-4" />
                      </button>

                      {/* Range/Duration Controls */}
                      {hasTimestamp && (
                        <div className="flex items-center h-8 bg-zinc-900 rounded-sm border border-zinc-800 overflow-hidden mr-2">
                          {/* Start Time (IN) */}
                          <div
                            className="px-2 text-xs font-mono font-bold text-zinc-400 border-r border-zinc-800 flex items-center h-full bg-black/20 cursor-default"
                            title="Tempo de início (IN)"
                          >
                            {formatTimecode(currentTime)}
                          </div>

                          {/* Range Actions */}
                          {!isRangeMode ? (
                            <button
                              type="button"
                              onClick={() => {
                                setIsRangeMode(true);
                                setRangeEndTime(currentTime + 5); // Default 5s duration
                              }}
                              className="px-3 h-full text-xs font-bold uppercase hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors flex items-center group"
                              title="Adicionar duração (Range)"
                            >
                              <span className="group-hover:text-red-500 transition-colors">
                                + Duração
                              </span>
                            </button>
                          ) : (
                            <>
                              {/* End Time (OUT) */}
                              <button
                                type="button"
                                onClick={() => setRangeEndTime(currentTime)}
                                className="px-2 h-full text-xs font-mono font-bold text-red-500 hover:bg-red-500/10 transition-colors flex items-center border-r border-zinc-800 min-w-[60px] justify-center"
                                title="Clique para definir o final do range na posição atual do vídeo"
                              >
                                {rangeEndTime !== null && rangeEndTime > currentTime
                                  ? formatTimecode(rangeEndTime)
                                  : "DEFINIR SAÍDA"}
                              </button>
                              {/* Clear Range */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsRangeMode(false);
                                  setRangeEndTime(null);
                                }}
                                className="px-2 h-full text-zinc-500 hover:text-white hover:bg-red-600 transition-colors flex items-center"
                                title="Remover duração"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

                      {/* Attachment */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => setAttachedFile(e.target.files[0])}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-2 rounded-sm transition-colors ${
                          attachedFile
                            ? "text-red-500 bg-red-500/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                        title="Anexar arquivo"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* Emoji picker */}
                      <div className="relative">
                        <button
                          type="button"
                          className={`p-2 rounded-sm transition-colors ${
                            showEmojiPicker
                              ? "text-yellow-500 bg-yellow-500/10"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          }`}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          title="Adicionar emoji"
                        >
                          <Smile className="w-4 h-4" />
                        </button>

                        {showEmojiPicker && (
                          <div className="absolute bottom-full left-0 mb-2 z-50">
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                setNewComment(newComment + emojiData.emoji);
                                setShowEmojiPicker(false);
                              }}
                              theme="dark"
                              width={300}
                              height={400}
                            />
                          </div>
                        )}
                      </div>

                      {/* Drawing tool */}
                      <button
                        type="button"
                        className={`p-2 rounded-sm transition-colors ${
                          drawingMode
                            ? "text-red-500 bg-red-500/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        } ${isComparing ? "opacity-40 cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (!isComparing) setDrawingMode(!drawingMode);
                        }}
                        title="Desenhar no frame"
                        disabled={isComparing}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Color picker - only when drawing mode is active */}
                      {drawingMode && (
                        <>
                          {["#FF0000", "#FFA500", "#FFFF00", "#00FF00", "#0000FF", "#FFFFFF"].map(
                            (color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-6 h-6 rounded-sm border transition-all ${
                                  drawColor === color
                                    ? "border-white scale-110"
                                    : "border-zinc-700 hover:border-zinc-500"
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setDrawColor(color)}
                                title={`Cor: ${color}`}
                              />
                            )
                          )}

                          <button
                            type="button"
                            className="p-2 rounded-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors ml-1"
                            onClick={clearDrawing}
                            title="Limpar desenho"
                          >
                            <Eraser className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Send button */}
                    <button
                      type="submit"
                      disabled={!newComment.trim() || (isGuest && !canComment)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
                    >
                      Enviar
                    </button>
                  </div>
                </div>

                {isGuest && !canComment && (
                  <p className="text-xs text-zinc-600 italic">
                    Este compartilhamento é somente visualização.
                  </p>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Share Link Dialog Fallback */}
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
                  className="bg-red-600 hover:bg-red-700 text-white rounded-none h-10 px-4 text-xs font-black uppercase tracking-widest"
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={() => confirmDialog.onConfirm?.()}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
      />
    </>
  );
}
