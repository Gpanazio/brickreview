import { useState, useEffect, useMemo, memo, useCallback, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useUpload } from "../../context/UploadContext";
import { VideoPlayer } from "../player/VideoPlayer";
import { FolderView } from "./FolderView";
import { Button } from "@/components/ui/button";
import { formatVideoDuration } from "../../utils/time";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Play,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Plus,
  MoreVertical,
  FileVideo,
  LayoutGrid,
  FolderTree,
  FolderPlus,
  History,
  Share2,
  Trash2,
  Archive,
  Folder,
  FolderOpen,
  Download,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { MoveItemDialog } from "./MoveItemDialog";

export function ProjectDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const { uploadFiles, uploadQueue: globalUploadQueue, isUploading, registerRefreshCallback } = useUpload();
  const [loading, setLoading] = useState(true);
  // const [uploading, setUploading] = useState(false); // Removed local state
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'folders'

  const currentFolderId = searchParams.get("folder") ? Number(searchParams.get("folder")) : null;
  const setCurrentFolderId = (folderId) => {
    if (folderId) {
      setSearchParams({ folder: folderId });
    } else {
      setSearchParams({});
    }
  };

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  const [moveDialog, setMoveDialog] = useState({
    isOpen: false,
    itemType: null,
    itemId: null,
    currentProjectId: null,
  });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "Confirmar ação",
    message: "Tem certeza que deseja continuar?",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "danger",
    onConfirm: null,
  });
  const { token } = useAuth();

  const dragCounter = useRef(0);

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

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionBoxRef = useRef(selectionBox);
  const containerRef = useRef(null);

  const handleDownloadAll = async () => {
    const toastId = toast.loading("Preparando downloads...");
    let count = 0;

    // Download Videos
    for (const video of currentLevelVideos) {
      if (video.parent_video_id) continue;
      try {
        const response = await fetch(`/api/videos/${video.id}/download?type=original`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const link = document.createElement("a");
          link.href = data.url;
          link.download = data.filename;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          count++;
          await new Promise((resolve) => setTimeout(resolve, 800)); // Delay to avoid browser blocking
        }
      } catch (error) {
        console.error("Erro ao baixar video:", video.title, error);
      }
    }

    // Download Files
    for (const file of currentLevelFiles) {
      try {
        // Files usually have direct R2 URL in r2_url
        if (file.r2_url) {
          const link = document.createElement("a");
          link.href = file.r2_url;
          link.download = file.name;
          link.target = "_blank";
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          count++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error("Erro ao baixar arquivo:", file.name, error);
      }
    }

    toast.success(`${count} downloads iniciados`, { id: toastId });
  };

  const startSelection = (e) => {
    if (e.target.closest("button") || e.target.closest(".context-menu-trigger")) return;
    // Only left click
    if (e.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    setIsSelecting(true);
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
    setSelectedItems(new Set());
  };

  const updateSelection = useCallback((e) => {
    if (!isSelecting || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    setSelectionBox((prev) => ({ ...prev, endX: x, endY: y }));
  }, [isSelecting]);

  const endSelection = useCallback(() => {
    if (!isSelecting) return;
    setIsSelecting(false);

    // Calculate final selection
    const box = selectionBoxRef.current;
    if (!box || !containerRef.current) return;

    const left = Math.min(box.startX, box.endX);
    const top = Math.min(box.startY, box.endY);
    const width = Math.abs(box.startX - box.endX);
    const height = Math.abs(box.startY - box.endY);

    // If box is too small, treat as click and clear selection (unless shift key?)
    if (width < 5 && height < 5) {
      setSelectionBox(null);
      return;
    }

    const newSelected = new Set();

    // Check intersection with items
    const items = containerRef.current.querySelectorAll("[data-selectable-id]");
    items.forEach((item) => {
      const itemRect = item.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Relative item position
      const itemLeft = itemRect.left - containerRect.left + containerRef.current.scrollLeft;
      const itemTop = itemRect.top - containerRect.top + containerRef.current.scrollTop;

      if (
        left < itemLeft + itemRect.width &&
        left + width > itemLeft &&
        top < itemTop + itemRect.height &&
        top + height > itemTop
      ) {
        newSelected.add(item.getAttribute("data-selectable-id"));
      }
    });

    setSelectedItems(newSelected);
    setSelectionBox(null);
  }, [isSelecting]);

  useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  useEffect(() => {
    if (isSelecting) {
      window.addEventListener("mousemove", updateSelection);
      window.addEventListener("mouseup", endSelection);
    }
    return () => {
      window.removeEventListener("mousemove", updateSelection);
      window.removeEventListener("mouseup", endSelection);
    };
  }, [isSelecting, updateSelection, endSelection]);

  const breadcrumbs = useMemo(() => {
    const path = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = folders.find((f) => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parent_folder_id;
      } else {
        break;
      }
    }
    return path;
  }, [currentFolderId, folders]);

  const fetchProjectDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.error || "Erro ao buscar detalhes do projeto";
        toast.error(message);
        setProject(null);
        return;
      }

      setProject(data);
    } catch (_err) {
      console.error("Erro ao buscar detalhes do projeto:", _err);
      toast.error("Erro ao buscar detalhes do projeto");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch(`/api/folders/project/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        const message = data?.error || "Erro ao buscar pastas";
        toast.error(message);
        setFolders([]);
        return;
      }

      setFolders(Array.isArray(data) ? data : []);
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao buscar pastas");
      setFolders([]);
    }
  }, [id, token]);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/files/project/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        const message = data?.error || "Erro ao buscar arquivos";
        toast.error(message);
        setFiles([]);
        return;
      }

      setFiles(Array.isArray(data) ? data : []);
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao buscar arquivos");
      setFiles([]);
    }
  }, [id, token]);

  useEffect(() => {
    fetchProjectDetails();
    fetchFolders();
    fetchFiles();
  }, [fetchProjectDetails, fetchFolders, fetchFiles]);

  // Register callback to refresh data after successful uploads
  useEffect(() => {
    const handleRefresh = () => {
      fetchProjectDetails();
      fetchFolders();
      fetchFiles();
    };

    const unregister = registerRefreshCallback(handleRefresh);
    return () => unregister();
  }, [registerRefreshCallback, fetchProjectDetails, fetchFolders, fetchFiles]);

  // Polling para atualizar status de vídeos em processamento
  useEffect(() => {
    const hasProcessing = project?.videos?.some(
      (v) => v.status === "pending" || v.status === "processing"
    );

    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchProjectDetails();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [project, fetchProjectDetails]);

  const handleCreateFolder = async (name, parentFolderId = null) => {
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: parseInt(id),
          parent_folder_id: parentFolderId,
          name,
        }),
      });

      if (response.ok) {
        fetchFolders();
      }
    } catch (_error) {
      console.error("Error", _error);
    }
  };

  const openMoveDialog = (type, itemId) => {
    setMoveDialog({
      isOpen: true,
      itemType: type,
      itemId: itemId,
      currentProjectId: parseInt(id),
    });
  };

  const handleMoveItemSuccess = () => {
    setMoveDialog({ ...moveDialog, isOpen: false });
    toast.success("Item movido com sucesso!");
    fetchProjectDetails();
    fetchFolders();
    fetchFiles();
  };

  const handleGenerateFolderShare = async (folderId) => {
    const loadingToast = toast.loading("Gerando link de compartilhamento da pasta...");

    // Helper para cópia robusta
    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_err) {
        console.warn(_err);
      }

      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return successful;
      } catch (_err) {
        return false;
      }
    };

    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_id: folderId,
          access_type: "comment",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}/share/${data.token}`;
        setShareLink(shareUrl);

        const copied = await copyToClipboard(shareUrl);
        if (copied) {
          toast.success("Link da pasta copiado!", {
            id: loadingToast,
            description: "O link de revisão já está na sua área de transferência.",
          });
        } else {
          toast.dismiss(loadingToast);
          setShowShareDialog(true);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao gerar link", { id: loadingToast });
      }
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao gerar link de compartilhamento", { id: loadingToast });
    }
  };

  const handleGenerateVideoShare = async (videoId) => {
    const loadingToast = toast.loading("Gerando link de compartilhamento...");

    // Helper para cópia robusta
    const copyToClipboard = async (text) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_err) {
        console.warn(_err);
      }

      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return successful;
      } catch (_err) {
        return false;
      }
    };

    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: videoId,
          access_type: "comment",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}/share/${data.token}`;
        setShareLink(shareUrl);

        const copied = await copyToClipboard(shareUrl);
        if (copied) {
          toast.success("Link copiado!", {
            id: loadingToast,
            description: "O link de revisão já está na sua área de transferência.",
          });
        } else {
          toast.dismiss(loadingToast);
          setShowShareDialog(true);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao gerar link", { id: loadingToast });
      }
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao gerar link de compartilhamento", { id: loadingToast });
    }
  };

  const performDeleteVideo = async (videoId) => {
    const loadingToast = toast.loading("Excluindo vídeo...");

    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success("Vídeo excluído com sucesso!", { id: loadingToast });
        fetchProjectDetails();
        fetchFolders();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao excluir vídeo", { id: loadingToast });
      }
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao excluir vídeo", { id: loadingToast });
    }
  };

  const handleDeleteVideo = (videoId) => {
    openConfirmDialog({
      title: "Excluir vídeo",
      message: "Tem certeza que deseja excluir este vídeo? Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "danger",
      onConfirm: () => performDeleteVideo(videoId),
    });
  };

  const handleArchiveVideo = async (_videoId) => {
    const loadingToast = toast.loading("Arquivando vídeo...");

    try {
      // TODO: Implementar lógica de arquivamento no backend
      // Por ora, apenas mostra mensagem
      toast.info("Funcionalidade de arquivamento em breve!", { id: loadingToast });
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao arquivar vídeo", { id: loadingToast });
    }
  };

  // Filter uploads for current project
  const uploadQueue = useMemo(
    () => globalUploadQueue.filter((u) => u.projectId === id),
    [globalUploadQueue, id]
  );

  const handleFileUpload = async (e, filesList = null) => {
    const rawFiles = filesList || e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const filesToUpload = Array.from(rawFiles);

    // Helper to get folder name
    const getFolderName = (folderId) => {
      if (!folderId) return "Raiz do Projeto";
      const folder = folders.find((f) => f.id === folderId);
      return folder ? folder.name : "Pasta Desconhecida";
    };

    // Check for duplicates
    const duplicates = [];
    for (const file of filesToUpload) {
      const isVideo = file.type.startsWith("video/");
      const name = file.name;
      const title = name.split(".")[0];

      let existingItem = null;
      if (isVideo) {
        existingItem = project?.videos?.find((v) => v.title === title);
      } else {
        existingItem = files.find((f) => f.name === name);
      }

      if (existingItem) {
        const location = getFolderName(existingItem.folder_id);
        duplicates.push(`${name} (em ${location})`);
      }
    }

    if (duplicates.length > 0) {
      openConfirmDialog({
        title: "Arquivos duplicados",
        message: `Os seguintes arquivos já existem no projeto:\n\n${duplicates.join("\n")}\n\nDeseja continuar e criar duplicatas?`,
        confirmText: "Continuar Upload",
        cancelText: "Cancelar",
        variant: "warning",
        onConfirm: () => {
          uploadFiles(filesToUpload, id, currentFolderId);
          if (e?.target) e.target.value = "";
        },
      });
      return;
    }

    uploadFiles(filesToUpload, id, currentFolderId);

    // setUploading(true); // handled by context
    // setTimeout(() => setUploading(false), 1000);

    if (e?.target) e.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDraggingFile(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Aceita qualquer tipo de arquivo
      handleFileUpload(null, Array.from(files));
    }
  };

  const handleCreateVersion = async (draggedVideoId, targetVideoId) => {
    const versionToast = toast.loading("Criando nova versão...");

    try {
      const response = await fetch(`/api/videos/${draggedVideoId}/create-version`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parent_video_id: targetVideoId }),
      });

      if (response.ok) {
        toast.success("Nova versão criada com sucesso!", { id: versionToast });
        fetchProjectDetails();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao criar versão", { id: versionToast });
      }
    } catch (_error) {
      console.error("Error", _error);
      toast.error("Erro ao criar versão", { id: versionToast });
    }
  };

  const handleMoveVideo = async (videoId, folderId) => {
    const moveToast = toast.loading("Movendo vídeo...");

    try {
      const response = await fetch(`/api/videos/${videoId}/move`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_id: folderId }),
      });

      if (response.ok) {
        toast.success("Vídeo movido com sucesso!", { id: moveToast });
        fetchProjectDetails();
        fetchFolders();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao mover vídeo", { id: moveToast });
      }
    } catch (_error) {
      console.error("Erro ao mover vídeo:", _error);
      toast.error("Erro ao mover vídeo", { id: moveToast });
    }
  };

  const handleMoveFolder = async (folderId, parentFolderId) => {
    const moveToast = toast.loading("Movendo pasta...");

    try {
      const response = await fetch(`/api/folders/${folderId}/move`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parent_folder_id: parentFolderId }),
      });

      if (response.ok) {
        toast.success("Pasta movida com sucesso!", { id: moveToast });
        fetchFolders();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao mover pasta", { id: moveToast });
      }
    } catch (_error) {
      console.error("Erro ao mover pasta:", _error);
      toast.error("Erro ao mover pasta", { id: moveToast });
    }
  };

  const handleDownloadVideo = async (videoId, type) => {
    const loadingToast = toast.loading("Gerando link de download...");
    try {
      const response = await fetch(`/api/videos/${videoId}/download?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const link = document.createElement("a");
        link.href = data.url;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download iniciado", { id: loadingToast });
      } else {
        toast.error("Erro ao gerar download", { id: loadingToast });
      }
    } catch (_error) {
      console.error("Erro ao fazer download:", _error);
      toast.error("Falha no download", { id: loadingToast });
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetchFolders();
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="h-10 w-10 animate-spin border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!project) return <div className="p-8 text-white">Projeto não encontrado</div>;

  if (selectedVideo) {
    const videoVersions =
      project?.videos?.filter((v) => v.parent_video_id === selectedVideo.id) || [];

    return (
      <VideoPlayer
        video={selectedVideo}
        versions={videoVersions}
        onBack={() => {
          setSelectedVideo(null);
          fetchProjectDetails();
        }}
      />
    );
  }

  const currentLevelFolders = folders.filter(
    (f) =>
      f.parent_folder_id === currentFolderId || (!currentFolderId && f.parent_folder_id === null)
  );

  const currentLevelVideos = (project?.videos || []).filter(
    (v) => v.folder_id === currentFolderId || (!currentFolderId && v.folder_id === null)
  );

  const currentLevelFiles = files.filter(
    (f) => f.folder_id === currentFolderId || (!currentFolderId && f.folder_id === null)
  );

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header do Projeto */}
      <header className="border-b border-zinc-800/20 glass-panel px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 relative z-10">
          <div className="flex items-center gap-4 flex-1">
            <motion.div
              whileHover={{ x: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Link
                to="/"
                className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50 flex-shrink-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="brick-title text-2xl md:text-4xl tracking-tighter uppercase leading-tight mb-2 break-words"
              >
                {project.name}
              </motion.h1>
              <div className="flex items-center gap-2">
                <span className="h-[1px] w-4 bg-red-600" />
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em] font-black truncate">
                  <span className="hidden sm:inline">Cliente: </span>
                  <span className="text-zinc-300">{project.client_name || "N/A"}</span> •{" "}
                  {project.videos?.length || 0} Itens
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 border-t border-zinc-800/30 pt-4 md:pt-0 md:border-none">
            {/* View Mode Toggle */}
            <div className="flex bg-zinc-950/50 p-1 border border-zinc-800/50">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-9 h-9 flex items-center justify-center transition-all ${viewMode === "grid"
                  ? "bg-red-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("folders")}
                className={`w-9 h-9 flex items-center justify-center transition-all ${viewMode === "folders"
                  ? "bg-red-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                <FolderTree className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
              multiple
            />
            <Button
              asChild
              className="glass-button-primary border-none rounded-none px-6 h-10 font-black uppercase tracking-widest text-xs"
              disabled={isUploading}
            >
              <label htmlFor="file-upload" className="cursor-pointer flex items-center">
                <Upload className="w-4 h-4 mr-3" />
                Upload
              </label>
            </Button>
          </div>
        </div>
      </header>

      {/* Lista de Vídeos */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseDown={startSelection}
        ref={containerRef}
      >
        {/* Selection Box Overlay */}
        {isSelecting && selectionBox && (
          <div
            className="absolute border border-blue-500 bg-blue-500/20 pointer-events-none z-50"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.startX - selectionBox.endX),
              height: Math.abs(selectionBox.startY - selectionBox.endY),
            }}
          />
        )}
        {/* Drop Zone Overlay */}
        <AnimatePresence>
          {isDraggingFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm border-4 border-dashed border-red-600 flex items-center justify-center pointer-events-none"
            >
              <div className="text-center">
                <Upload className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <p className="brick-title text-2xl text-white mb-2">Solte os vídeos aqui</p>
                <p className="brick-tech text-xs text-zinc-400 uppercase tracking-widest">
                  Upload automático para {currentFolderId ? "a pasta atual" : "o projeto"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ContextMenu>
          <ContextMenuTrigger className="min-h-full block">
            {/* Breadcrumbs Navigation */}
            <div className="flex items-center gap-2 mb-6 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 overflow-x-auto no-scrollbar pb-2">
              <button
                onClick={() => setCurrentFolderId(null)}
                className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${!currentFolderId ? "text-white" : ""}`}
              >
                {project?.name || "Projeto"}
              </button>
              {breadcrumbs.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-zinc-800" />
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${index === breadcrumbs.length - 1 ? "text-white" : ""}`}
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {viewMode === "folders" ? (
                <motion.div
                  key="folders"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-panel border border-zinc-800/30 rounded-none p-6"
                >
                  <FolderView
                    folders={folders}
                    videos={project?.videos || []}
                    files={files}
                    currentFolderId={currentFolderId}
                    onFolderClick={(folder) => setCurrentFolderId(folder.id)}
                    onVideoClick={(video) => setSelectedVideo(video)}
                    onCreateFolder={handleCreateFolder}
                    onDeleteFolder={fetchFolders}
                    onMoveVideo={handleMoveVideo}
                    onMoveFolder={handleMoveFolder}
                    onFileDelete={fetchFiles}
                    onGenerateFolderShare={handleGenerateFolderShare}
                    token={token}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {currentLevelFolders.length === 0 &&
                    currentLevelVideos.length === 0 &&
                    currentLevelFiles.length === 0 &&
                    uploadQueue.length === 0 &&
                    !currentFolderId ? (
                    <div className="flex flex-col items-center justify-center h-80 border border-dashed border-zinc-800 bg-zinc-950/10">
                      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                        <FileVideo className="w-8 h-8 text-zinc-700" />
                      </div>
                      <p className="text-zinc-600 uppercase tracking-[0.4em] font-black text-[10px]">
                        Aguardando primeiro upload
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                    >
                      {/* Folder Cards */}
                      {currentLevelFolders.map((folder) => (
                        <motion.div
                          key={`folder-card-${folder.id}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          data-selectable-id={`folder-${folder.id}`}
                        >
                          <FolderCard
                            folder={folder}
                            isSelected={selectedItems.has(`folder-${folder.id}`)}
                            onClick={() => {
                              if (selectedItems.size > 0) {
                                // Handle selection click behavior if needed
                                // For now, normal navigation overrides selection unless shift/ctrl logic added
                              }
                              setCurrentFolderId(folder.id);
                            }}
                            onGenerateShare={() => handleGenerateFolderShare(folder.id)}
                            onMoveVideo={handleMoveVideo}
                            onMoveFolder={handleMoveFolder}
                            onMove={() => openMoveDialog("folder", folder.id)}
                            onDelete={() => {
                              openConfirmDialog({
                                title: "Excluir pasta",
                                message: "Tem certeza que deseja excluir esta pasta?",
                                confirmText: "Excluir",
                                cancelText: "Cancelar",
                                variant: "danger",
                                onConfirm: async () => {
                                  try {
                                    const response = await fetch(`/api/folders/${folder.id}`, {
                                      method: "DELETE",
                                      headers: { Authorization: `Bearer ${token}` },
                                    });

                                    if (response.ok) {
                                      toast.success("Pasta excluída");
                                      fetchFolders();
                                    } else {
                                      const errorData = await response.json().catch(() => ({}));
                                      toast.error(errorData.error || "Erro ao excluir pasta");
                                    }
                                  } catch (_error) {
                                    console.error("Error", _error);
                                    toast.error("Erro ao excluir pasta");
                                  }
                                },
                              });
                            }}
                          />
                        </motion.div>
                      ))}

                      {/* Uploading Cards */}
                      {uploadQueue.map((upload) => {
                        const isSuccess = upload.status === "success";
                        const isError = upload.status === "error";

                        const accentBorderClass = isSuccess
                          ? "border-l-green-600/50"
                          : "border-l-red-600/50";

                        const overlayClass = isSuccess ? "bg-green-900/10" : "bg-red-900/10";

                        const progressClass = isSuccess ? "bg-green-600" : "bg-red-600";

                        const headline = isSuccess
                          ? "Sucesso"
                          : isError
                            ? "Falha"
                            : "Processando...";

                        const subline = isSuccess
                          ? upload.isVideo
                            ? "Processamento iniciado"
                            : "Arquivo salvo"
                          : isError
                            ? "Falha no upload"
                            : "Enviando arquivo";

                        return (
                          <motion.div
                            key={upload.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-card border-none rounded-none overflow-hidden h-full flex flex-col relative"
                          >
                            <div className="aspect-video bg-zinc-900/50 flex flex-col items-center justify-center border-b border-zinc-800/50 relative overflow-hidden">
                              <motion.div
                                className={`absolute inset-0 ${overlayClass}`}
                                animate={{ opacity: [0.1, 0.3, 0.1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />

                              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 flex items-center justify-center mb-4 relative z-10">
                                {isSuccess ? (
                                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                                ) : isError ? (
                                  <AlertCircle className="w-6 h-6 text-red-500" />
                                ) : (
                                  <>
                                    <motion.div
                                      className="absolute inset-0 border-2 border-red-600 rounded-full border-t-transparent"
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    />
                                    <Upload className="w-5 h-5 text-zinc-500" />
                                  </>
                                )}
                              </div>

                              <p
                                className={`brick-tech text-[10px] uppercase tracking-widest ${isSuccess ? "text-green-500" : isError ? "text-red-500" : "text-red-500"} ${isSuccess || isError ? "" : "animate-pulse"}`}
                              >
                                {headline}
                              </p>
                            </div>

                            <div
                              className={`p-5 border-l-2 ${accentBorderClass} flex-1 flex flex-col justify-between bg-zinc-950/30`}
                            >
                              <div>
                                <h3 className="brick-title text-sm text-zinc-400 truncate mb-1">
                                  {upload.name}
                                </h3>
                                <p className="brick-manifesto text-[10px] text-zinc-600 truncate">
                                  {subline}
                                </p>
                              </div>
                              <div className="mt-4 h-1 w-full bg-zinc-900 overflow-hidden">
                                <motion.div
                                  className={`h-full ${progressClass}`}
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{
                                    duration: isSuccess || isError ? 0.4 : 15,
                                    ease: "linear",
                                  }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}

                      {currentLevelVideos
                        .filter((v) => !v.parent_video_id) // Só mostra vídeos raiz (não versões)
                        .map((video) => {
                          const versions = (project?.videos || []).filter(
                            (v) => v.parent_video_id === video.id
                          );
                          return (
                            <motion.div
                              key={video.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              data-selectable-id={`video-${video.id}`}
                            >
                              <VideoCard
                                video={video}
                                versions={versions}
                                isSelected={selectedItems.has(`video-${video.id}`)}
                                onClick={() => setSelectedVideo(video)}
                                onCreateVersion={handleCreateVersion}
                                onDelete={(videoId) => handleDeleteVideo(videoId)}
                                onArchive={(videoId) => handleArchiveVideo(videoId)}
                                onGenerateShare={(videoId) => handleGenerateVideoShare(videoId)}
                                onDownload={(type) => handleDownloadVideo(video.id, type)}
                                onMove={() => openMoveDialog("video", video.id)}
                              />
                            </motion.div>
                          );
                        })}

                      {/* File Cards */}
                      {currentLevelFiles.map((file) => (
                        <motion.div
                          key={`file-${file.id}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          data-selectable-id={`file-${file.id}`}
                        >
                          <FileCard
                            file={file}
                            isSelected={selectedItems.has(`file-${file.id}`)}
                            onMove={() => openMoveDialog("file", file.id)}
                            onDelete={() => {
                              openConfirmDialog({
                                title: "Excluir arquivo",
                                message: "Tem certeza que deseja excluir este arquivo?",
                                confirmText: "Excluir",
                                cancelText: "Cancelar",
                                variant: "danger",
                                onConfirm: async () => {
                                  try {
                                    const response = await fetch(`/api/files/${file.id}`, {
                                      method: "DELETE",
                                      headers: { Authorization: `Bearer ${token}` },
                                    });

                                    if (response.ok) {
                                      toast.success("Arquivo excluído");
                                      fetchFiles();
                                    } else {
                                      const errorData = await response.json().catch(() => ({}));
                                      toast.error(errorData.error || "Erro ao excluir arquivo");
                                    }
                                  } catch (_error) {
                                    console.error("Error", _error);
                                    toast.error("Erro ao excluir arquivo");
                                  }
                                },
                              });
                            }}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
            <ContextMenuItem
              className="focus:bg-red-600 focus:text-white cursor-pointer"
              onClick={() => setIsCreateFolderOpen(true)}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Nova Pasta
            </ContextMenuItem>
            <ContextMenuItem
              className="focus:bg-red-600 focus:text-white cursor-pointer"
              onClick={() => document.getElementById("file-upload").click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Novo Upload
            </ContextMenuItem>
            {currentFolderId && (
              <ContextMenuItem
                className="focus:bg-red-600 focus:text-white cursor-pointer"
                onClick={() => handleGenerateFolderShare(currentFolderId)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Gerar Link de Compartilhamento
              </ContextMenuItem>
            )}
            <ContextMenuItem
              className="focus:bg-red-600 focus:text-white cursor-pointer"
              onClick={handleDownloadAll}
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Tudo
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onConfirm={(name) => handleCreateFolder(name, currentFolderId)}
      />

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

      <MoveItemDialog
        isOpen={moveDialog.isOpen}
        onClose={() => setMoveDialog({ ...moveDialog, isOpen: false })}
        itemType={moveDialog.itemType}
        itemId={moveDialog.itemId}
        currentProjectId={moveDialog.currentProjectId}
        onSuccess={handleMoveItemSuccess}
        token={token}
      />
    </div>
  );
}

// Helper para formatar tamanho de arquivo
const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FolderCard = memo(
  ({
    folder,
    onClick,
    onGenerateShare,
    onDelete,
    onMoveVideo,
    onMoveFolder,
    onMove,
    isSelected,
  }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const previews = folder.previews || [];
    const hasPreviews = previews.length > 0;

    const handleDragStart = (e) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-brick-folder-id", String(folder.id));
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const hasVideoData = e.dataTransfer.types.includes("application/x-brick-video-id");
      const hasFolderData = e.dataTransfer.types.includes("application/x-brick-folder-id");
      if (hasVideoData || hasFolderData) {
        setIsDragOver(true);
        e.dataTransfer.dropEffect = "move";
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      try {
        const videoId = e.dataTransfer.getData("application/x-brick-video-id");
        const folderId = e.dataTransfer.getData("application/x-brick-folder-id");

        if (videoId) {
          onMoveVideo?.(parseInt(videoId), folder.id);
        } else if (folderId) {
          if (Number(folderId) !== folder.id) {
            onMoveFolder?.(parseInt(folderId), folder.id);
          }
        }
      } catch (_error) {
        console.error("Error", _error);
      }
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`group glass-card border-none rounded-none overflow-hidden cursor-pointer relative flex flex-col h-full transition-all ${isDragOver ? "ring-2 ring-blue-500 scale-105" : ""} ${isSelected ? "ring-2 ring-red-600 bg-red-900/10" : ""}`}
            onClick={onClick}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-blue-900/50 backdrop-blur-sm flex items-center justify-center"
              >
                <p className="text-white font-bold text-xs uppercase tracking-widest">
                  Mover para esta pasta
                </p>
              </motion.div>
            )}
            <div className="aspect-video bg-zinc-900 relative overflow-hidden flex-shrink-0">
              {!hasPreviews ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
                  <Folder className="w-12 h-12 text-zinc-800 group-hover:text-zinc-700 transition-colors" />
                </div>
              ) : (
                <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-[1px] bg-zinc-950">
                  <div
                    className={`relative bg-zinc-900 overflow-hidden ${previews.length === 1 ? "col-span-2 row-span-2" : "col-span-1 row-span-2"
                      }`}
                  >
                    <img
                      src={previews[0]}
                      alt={`Pré-visualização 1 para a pasta ${folder.name}`}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
                    />
                    {previews.length > 1 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <Folder className="w-5 h-5 text-white/70" />
                        </div>
                      </div>
                    )}
                  </div>

                  {previews.length > 1 && (
                    <div className="col-span-1 row-span-2 flex flex-col gap-[1px]">
                      {[previews[1], previews[2]].map((previewSrc, index) => (
                        <div
                          key={previewSrc || `placeholder-${index}`}
                          className="flex-1 bg-zinc-900 overflow-hidden relative"
                        >
                          {previewSrc ? (
                            <img
                              src={previewSrc}
                              alt={`Pré-visualização ${index + 2} para a pasta ${folder.name}`}
                              className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-all duration-700 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900/50" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Folder Icon Overlay (Always visible but subtle) */}
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg flex items-center gap-1.5">
                <Folder className="w-3 h-3" />
                Pasta
              </div>
            </div>

            <div className="p-5 border-l-2 border-l-transparent group-hover:border-l-red-600 transition-all flex-1 flex flex-col justify-between bg-zinc-950/30">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="brick-title text-sm text-white truncate mb-1 group-hover:text-red-500 transition-colors">
                    {folder.name}
                  </h3>
                  <p className="brick-manifesto text-[10px] text-zinc-500 truncate uppercase tracking-widest font-bold">
                    {folder.videos_count > 0
                      ? `${folder.videos_count} vídeo${folder.videos_count > 1 ? "s" : ""}`
                      : ""}
                    {folder.videos_count > 0 &&
                      (folder.subfolders_count > 0 || folder.files_count > 0)
                      ? ", "
                      : ""}
                    {folder.subfolders_count > 0
                      ? `${folder.subfolders_count} pasta${folder.subfolders_count > 1 ? "s" : ""}`
                      : ""}
                    {folder.subfolders_count > 0 && folder.files_count > 0 ? ", " : ""}
                    {folder.files_count > 0
                      ? `${folder.files_count} arquivo${folder.files_count > 1 ? "s" : ""}`
                      : ""}
                    {!(folder.videos_count || folder.subfolders_count || folder.files_count)
                      ? "Vazio"
                      : ""}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-zinc-700 hover:text-white transition-colors p-1 hover:bg-zinc-800/50 rounded-sm">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300" align="end">
                      <DropdownMenuItem onClick={() => onGenerateShare?.()}>
                        <Share2 className="mr-2 h-4 w-4" /> Gerar Link de Revisão
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onMove?.()}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Mover para...
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-500" onClick={() => onDelete?.()}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-900/50">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="w-3 h-3 text-zinc-600" />
                  <span className="brick-tech text-[9px] text-zinc-500 uppercase">
                    Acessar conteúdo
                  </span>
                </div>
                <div className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest">
                  Pasta
                </div>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onGenerateShare?.();
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Gerar Link de Revisão
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onMove?.();
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Mover para...
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Pasta
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

const FileCard = memo(({ file, onDelete, onMove, isSelected }) => {
  const isImage = file.file_type === "image";

  const getFileTypeLabel = (type) => {
    switch (type) {
      case "image":
        return "Imagem";
      case "audio":
        return "Áudio";
      case "document":
        return "Documento";
      default:
        return "Arquivo";
    }
  };

  const getFileTypeColor = (type) => {
    switch (type) {
      case "image":
        return "bg-green-600";
      case "audio":
        return "bg-purple-600";
      case "document":
        return "bg-orange-600";
      default:
        return "bg-zinc-600";
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={`glass-card border-none rounded-none overflow-hidden h-full flex flex-col relative group cursor-pointer ${isSelected ? "ring-2 ring-red-600 bg-red-900/10" : ""}`}
          onClick={() => window.open(file.r2_url, "_blank")}
        >
          <div className="aspect-video bg-zinc-900 relative overflow-hidden flex-shrink-0">
            {isImage && file.thumbnail_url ? (
              <img
                src={file.thumbnail_url}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                alt={file.name}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <div
                  className={`w-16 h-16 ${getFileTypeColor(file.file_type)} flex items-center justify-center`}
                >
                  <span className="text-white text-2xl font-black">
                    {file.name.split(".").pop()?.toUpperCase().slice(0, 4)}
                  </span>
                </div>
              </div>
            )}

            {/* Type Badge */}
            <div
              className={`absolute top-2 left-2 px-2 py-0.5 ${getFileTypeColor(file.file_type)} text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg`}
            >
              {getFileTypeLabel(file.file_type)}
            </div>

            {/* Size Badge */}
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-black text-white uppercase tracking-tighter">
              {formatFileSize(file.file_size)}
            </div>
          </div>

          <div className="p-5 border-l-2 border-l-transparent group-hover:border-l-green-600 transition-all flex-1 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="brick-title text-sm text-white truncate mb-1">{file.name}</h3>
                <p className="brick-manifesto text-[10px] text-zinc-500 truncate">
                  {file.mime_type}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-zinc-600 hover:text-white p-1.5 hover:bg-zinc-800/50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glass-panel border-zinc-800 rounded-none">
                  <DropdownMenuItem
                    className="text-xs uppercase tracking-wider cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove?.();
                    }}
                  >
                    <FolderOpen className="w-3 h-3 mr-2" />
                    Mover para...
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs uppercase tracking-wider text-red-500 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onMove?.();
          }}
          className="focus:bg-red-600 focus:text-white cursor-pointer"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Mover para...
        </ContextMenuItem>

        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="focus:bg-red-600 focus:text-white cursor-pointer text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

const VideoCard = memo(
  ({
    video,
    versions = [],
    onClick,
    onMove,
    onCreateVersion,
    onDelete,
    onArchive,
    onGenerateShare,
    onDownload,
    isSelected,
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const [dragCounter, setDragCounter] = useState(0);
    const totalVersions = versions.length + 1; // +1 para incluir a versão original
    const isProcessing = video.status === "pending" || video.status === "processing";
    const isFailed = video.status === "failed";

    const getStatusColor = (status) => {
      switch (status) {
        case "approved":
          return "bg-green-600";
        default:
          return "bg-zinc-600";
      }
    };

    const getStatusLabel = (status) => {
      switch (status) {
        case "approved":
          return "Aprovado";
        default:
          return "Em aprovação";
      }
    };

    const handleDragStart = (e) => {
      setIsDragging(true);
      e.dataTransfer.effectAllowed = "move";
      // Definimos o ID separadamente para compatibilidade e o objeto completo para conveniência
      e.dataTransfer.setData("application/x-brick-video-id", String(video.id));
      e.dataTransfer.setData("video", JSON.stringify(video));
    };

    const handleDragEnd = (_e) => {
      setIsDragging(false);
      setIsDropTarget(false);
      setDragCounter(0);
    };

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Verifica se o que está sendo arrastado é um vídeo do Brick
      const isVideo =
        e.dataTransfer.types.includes("video") ||
        e.dataTransfer.types.includes("application/x-brick-video-id");

      if (isVideo) {
        setDragCounter((prev) => prev + 1);
        setIsDropTarget(true);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const newCounter = dragCounter - 1;
      setDragCounter(newCounter);
      if (newCounter <= 0) {
        setIsDropTarget(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDropTarget(false);
      setDragCounter(0);

      try {
        const draggedVideoData = e.dataTransfer.getData("video");
        if (draggedVideoData) {
          const draggedVideo = JSON.parse(draggedVideoData);

          // Não permitir drop no mesmo vídeo nem em vídeos que já são versões
          if (draggedVideo.id !== video.id) {
            onCreateVersion?.(draggedVideo.id, video.id);
          }
        }
      } catch (_error) {
        console.error("Error", _error);
      }
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="relative">
            {/* Versões empilhadas no fundo */}
            {versions.slice(0, 3).map((v, index) => (
              <div
                key={v.id}
                className="absolute inset-0 glass-card border-none rounded-none bg-zinc-900/50"
                style={{
                  transform: `translateY(${(index + 1) * -4}px) translateX(${(index + 1) * 4}px)`,
                  zIndex: -(index + 1),
                }}
              />
            ))}

            {/* Card principal */}
            <div
              onClick={onClick}
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group glass-card border-none rounded-none overflow-hidden cursor-pointer relative flex flex-col h-full transition-all ${isDragging ? "opacity-50 scale-95" : ""
                } ${isDropTarget ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-black scale-105" : ""
                } ${isSelected ? "ring-2 ring-red-600 bg-red-900/10" : ""}`}
              style={{ zIndex: 1 }}
            >
              {/* Indicador de Drop para criar versão */}
              {isDropTarget && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-0 left-0 right-0 z-10 bg-blue-600 text-white text-center py-2 text-xs font-bold uppercase tracking-widest pointer-events-none"
                >
                  Solte para criar nova versão
                </motion.div>
              )}

              {/* Overlay de Processamento */}
              {(isProcessing || isFailed) && (
                <div className="absolute inset-0 z-20 bg-zinc-950/80 flex flex-col items-center justify-center backdrop-blur-sm border-b border-zinc-800">
                  {isProcessing ? (
                    <>
                      <div className="w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="brick-tech text-[10px] text-red-500 uppercase tracking-widest animate-pulse">
                        Processando...
                      </p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
                      <p className="brick-tech text-[10px] text-red-500 uppercase tracking-widest">
                        Falha no processamento
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="aspect-video bg-zinc-900 relative overflow-hidden flex-shrink-0 pointer-events-none">
                <img
                  src={
                    video.thumbnail_url ||
                    "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400"
                  }
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  alt={video.title}
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-transform transition-opacity duration-300 transform-gpu">
                    <Play className="w-6 h-6 text-white fill-current" />
                  </div>
                </div>

                {/* Status Badge Overlay */}
                <div
                  className={`absolute top-2 left-2 px-2 py-0.5 ${getStatusColor(video.latest_approval_status)} text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg`}
                >
                  {getStatusLabel(video.latest_approval_status)}
                </div>

                {/* Version Count Badge */}
                {totalVersions > 1 && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg flex items-center gap-1">
                    <History className="w-3 h-3" />
                    {totalVersions} Versões
                  </div>
                )}

                {/* Duração Overlay */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-black text-white uppercase tracking-tighter">
                  {formatVideoDuration(video.duration)}
                </div>
              </div>

              <div className="p-5 border-l-2 border-l-transparent group-hover:border-l-red-600 transition-all flex-1 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="brick-title text-sm text-white truncate mb-1">{video.title}</h3>
                    <p className="brick-manifesto text-[10px] text-zinc-500 truncate">
                      Versão final para aprovação do cliente
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-zinc-700 hover:text-white transition-colors p-1 hover:bg-zinc-800/50 rounded-sm">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300" align="end">
                        <DropdownMenuItem onClick={() => onGenerateShare?.(video.id)}>
                          <Share2 className="mr-2 h-4 w-4" /> Gerar Link de Revisão
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMove?.()}>
                          <FolderOpen className="mr-2 h-4 w-4" /> Mover para...
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload?.("original")}>
                          <Download className="mr-2 h-4 w-4" /> Baixar Original
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload?.("proxy")}>
                          <Download className="mr-2 h-4 w-4" /> Baixar Proxy (720p)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:text-amber-500" onClick={() => onArchive?.(video.id)}>
                          <Archive className="mr-2 h-4 w-4" /> Arquivar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:text-red-500" onClick={() => onDelete?.(video.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-900/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-zinc-600" />
                      <span className="brick-tech text-[9px] text-zinc-500 uppercase">
                        {video.comments_count || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-red-900/50" />
                      <span className="brick-tech text-[9px] text-red-600/80 uppercase">
                        V{video.version_number}
                      </span>
                    </div>
                  </div>
                  <div className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onGenerateShare?.(video.id);
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Gerar Link de Revisão
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onMove?.();
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Mover para...
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.("original");
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar Original
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.("proxy");
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar Proxy (720p)
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onArchive?.(video.id);
            }}
            className="focus:bg-amber-600 focus:text-white cursor-pointer"
          >
            <Archive className="w-4 h-4 mr-2" />
            Arquivar
          </ContextMenuItem>

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(video.id);
            }}
            className="focus:bg-red-600 focus:text-white cursor-pointer text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);
