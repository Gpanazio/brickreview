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
import { CommentSidebar } from "./subcomponents/CommentSidebar";

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
  const [rangeStartTime, setRangeStartTime] = useState(null); // Início do range
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

  const getResolutionLabel = (vid) => {
    if (!vid || !vid.width) return "Original";
    if (vid.width >= 3840) return "4K";
    if (vid.width >= 2560) return "1440p";
    if (vid.width >= 1920) return "1080p";
    if (vid.width >= 1280) return "720p";
    return `${vid.height}p`;
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
        console.log(`[VideoPlayer] Fetching stream URL for video ${currentVideoId}, quality: ${quality}`);
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
          console.log(`[VideoPlayer] Received stream URL:`, data);
          if (data.url) {
            // Se mudou o vídeo ou qualidade, salvamos o tempo atual
            // const savedTime = playerRef.current?.plyr?.currentTime || currentTime;
            setVideoUrl(data.url);

            // Após o loading (em outro useEffect), o plyr vai inicializar e podemos tentar dar seek
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[VideoPlayer] Failed to fetch stream URL:`, errorData);
          toast.error("Erro ao carregar vídeo: " + (errorData.error || "Falha na conexão"));
        }
      } catch (err) {
        console.error(`[VideoPlayer] Critical error fetching stream URL:`, err);
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
                      className={`rounded-none border px-3 h-8 text-xs font-black uppercase tracking-widest transition-all ${approvalStatus === "approved"
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
                    className={`rounded-none border px-3 h-8 text-xs font-black uppercase tracking-widest transition-all ${isComparing
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
                            className={`rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest ${v.id === compareVersionId
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
                        className={`rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest ${v.id === currentVideoId
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
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300 video-overlay-fade-in">
                  <div className="relative flex items-center justify-center scale-110">
                    {/* Outer animated ring */}
                    <div className="absolute w-20 h-20 border-2 border-red-600/20 rounded-full"></div>
                    <div className="absolute w-20 h-20 border-t-2 border-red-600 rounded-full animate-spin"></div>

                    {/* Inner static brand circle */}
                    <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-2xl">
                      <div className="brick-title text-[10px] text-white uppercase tracking-tighter">
                        Brick
                      </div>
                    </div>
                  </div>
                  <span className="mt-8 text-[9px] font-black uppercase tracking-[0.5em] text-zinc-400 animate-pulse">
                    Sincronizando
                  </span>
                </div>
              )}

              {/* Play/Pause Overlay (Z-40) */}
              {!isPlaying && !isLoadingVideo && videoSource && !isComparing && !isDrawing && (
                <div
                  className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px] flex items-center justify-center cursor-pointer group transition-all duration-500 hover:bg-black/40 video-overlay-fade-in"
                  onClick={() => playerRef.current?.plyr?.play()}
                >
                  <div className="relative flex items-center justify-center transform transition-all duration-500 group-hover:scale-105">
                    {/* Animated Glow effect */}
                    <div className="absolute inset-0 bg-red-600/20 blur-[100px] rounded-full scale-150 animate-pulse"></div>

                    {/* Big Play Button Container */}
                    <div className="w-24 h-24 bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-red-600/10 via-transparent to-white/5 opacity-50"></div>

                      {/* Play Icon */}
                      <div className="relative z-10 transform transition-transform duration-300 group-hover:translate-x-1">
                        <Play className="w-10 h-10 text-white fill-current drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
                      </div>

                      {/* Rotating border effect on hover */}
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-t-red-600/50 rounded-full animate-spin-slow"></div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Controles Unificada (Frame.io style) */}
          <div className="bg-[#0a0a0a] border-t border-zinc-800/50 flex flex-col relative z-30 overflow-visible">
            {/* Progress Scrubber */}
            <div
              className="w-full h-2 bg-zinc-900 cursor-pointer relative group overflow-visible"
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
                  <div className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 mt-1 brick-tech font-mono">
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

              {/* Range Markers (Rendered FIRST so they are behind single markers) */}
              {comments.map((comment) => {
                const range = getCommentRange(comment);
                if (!range || range.end === null || duration === 0) return null;

                const startPct = Math.min(100, Math.max(0, (range.start / duration) * 100));
                const endPct = Math.min(100, Math.max(0, (range.end / duration) * 100));
                const width = Math.max(0.2, endPct - startPct);

                return (
                  <div
                    key={`range-${comment.id}`}
                    className="absolute top-0 h-full bg-red-600/30 border-l border-r border-red-500/50 z-10 pointer-events-none group/range"
                    style={{ left: `${startPct}%`, width: `${width}%` }}
                  >
                    <div className="absolute inset-0 bg-red-600/10 group-hover/range:bg-red-600/20 transition-colors" />
                  </div>
                );
              })}

              {/* Single Markers & Range Handles */}
              {comments.map((comment) => {
                const range = getCommentRange(comment);
                const ts = parseTimestampSeconds(comment.timestamp);
                if (ts === null || duration === 0) return null;

                // Se for range, desenha marcadores de início e fim se não forem muito grudados?
                // Por simplicidade, desenhamos o marcador principal no start time sempre
                const left = Math.min(100, (ts / duration) * 100);
                const isRange = range && range.end !== null;

                return (
                  <button
                    key={`marker-${comment.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(ts);
                      setHighlightedCommentId(comment.id);
                    }}
                    className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 z-30 transition-all cursor-pointer group/marker -ml-[6px] outline-none focus:outline-none`}
                    style={{ left: `${left}%` }}
                  >
                    {/* Visual do Marcador */}
                    <div className={`w-full h-full rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.5)] transform transition-transform group-hover/marker:scale-150 ${isRange ? 'bg-amber-400 border border-amber-200' : 'bg-white border border-zinc-200'
                      }`} />

                    {/* Linha conectora vertical (opcional, estilo DaVinci Resolve) */}
                    <div className="absolute top-full left-1/2 w-px h-2 bg-white/50 -translate-x-1/2 group-hover/marker:h-4 transition-all" />

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none z-50">
                      <div className="bg-zinc-900 border border-zinc-700 px-2 py-1.5 rounded-sm shadow-xl flex items-center gap-2 whitespace-nowrap">
                        <div className={`w-1.5 h-1.5 rounded-full ${isRange ? 'bg-amber-400' : 'bg-red-500'}`} />
                        <span className="text-[10px] uppercase font-bold text-zinc-100 max-w-[150px] truncate">
                          {comment.username}
                        </span>
                      </div>
                      {/* Seta do tooltip */}
                      <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-700 mx-auto -mt-px relative z-10" />
                    </div>
                  </button>
                );
              })}

              {/* Current Range Selection Preview */}
              {isRangeMode && hasTimestamp && rangeEndTime !== null && duration > 0 && (
                <div
                  className="absolute top-0 h-full bg-white/50 border-x border-white z-20 pointer-events-none shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                  style={{
                    left: `${Math.min((rangeStartTime / duration) * 100, (rangeEndTime / duration) * 100)}%`,
                    width: `${Math.abs(((rangeEndTime - rangeStartTime) / duration) * 100)}%`,
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
                        className={`text-xs justify-center cursor-pointer font-bold ${playbackSpeed === speed
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
                      className={`text-xs font-bold uppercase tracking-widest h-8 px-2 rounded-none ${quality === "original" ? "text-red-500" : "text-zinc-500 hover:text-white"
                        }`}
                    >
                      {quality === "original" ? getResolutionLabel(currentVideo) : "720p"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    className="bg-zinc-950 border-zinc-800 rounded-none min-w-[100px]"
                  >
                    <DropdownMenuItem
                      onClick={() => setQuality("proxy")}
                      className={`text-xs cursor-pointer font-bold ${quality === "proxy"
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                        }`}
                    >
                      720p
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setQuality("original")}
                      className={`rounded-none cursor-pointer font-bold text-xs uppercase tracking-widest ${quality === "original"
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-400 focus:text-white focus:bg-zinc-800"
                        }`}
                    >
                      {getResolutionLabel(currentVideo)}
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
                  <div className="brick-tech font-mono text-white font-bold text-sm lg:text-lg tabular-nums tracking-tight leading-none">
                    {formatTimecode(currentTime)}
                  </div>
                  <div className="text-xs text-zinc-600 font-medium uppercase tracking-widest mt-0.5 brick-tech font-mono">
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


        {/* Barra Lateral de Comentarios / Historico - Usando componente refatorado */}
        <CommentSidebar
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          history={history}
          propCurrentVideo={currentVideo}
          propCurrentTime={currentTime}
          propComments={comments}
          propSetComments={setComments}
          propIsDrawingMode={drawingMode}
          propSetIsDrawingMode={setDrawingMode}
          propSeekTo={seekTo}
          propVisitorName={visitorName}
          propSetVisitorName={setVisitorName}
          propDrawings={drawings}
          propSetDrawings={setDrawings}
          propShareToken={shareToken}
          propSharePassword={sharePassword}
          propIsPublic={isPublic}
          propIsComparing={isComparing}
          propIsRangeMode={isRangeMode}
          propSetIsRangeMode={setIsRangeMode}
          propRangeStartTime={rangeStartTime}
          propSetRangeStartTime={setRangeStartTime}
          propRangeEndTime={rangeEndTime}
          propSetRangeEndTime={setRangeEndTime}
          propHasTimestamp={hasTimestamp}
          propSetHasTimestamp={setHasTimestamp}
        />

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
