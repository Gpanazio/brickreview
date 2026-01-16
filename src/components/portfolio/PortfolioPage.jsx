import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Upload,
  Play,
  Film,
  Eye,
  Code,
  Lock,
  Unlock,
  Trash2,
  Edit3,
  X,
  Copy,
  Check,
  Grid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PortfolioPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [editingVideo, setEditingVideo] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);
  const [deletingVideo, setDeletingVideo] = useState(null);
  const fileInputRef = useRef(null);

  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch("/api/portfolio/videos", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      } else {
        toast.error("Erro ao carregar vídeos do portfolio");
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Por favor, selecione um arquivo de vídeo");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", file.name);

    try {
      const response = await fetch("/api/portfolio/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        toast.success("Vídeo enviado com sucesso!");
        fetchVideos();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao fazer upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload do vídeo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setShowModal(true);
  };

  const handleCopyLink = async (link, type) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(type);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (_error) {
      toast.error("Erro ao copiar link");
    }
  };

  const handleDeleteClick = (video) => {
    setDeletingVideo(video);
  };

  const confirmDelete = async () => {
    if (!deletingVideo) return;

    try {
      const response = await fetch(`/api/portfolio/videos/${deletingVideo.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Vídeo excluído com sucesso!");
        fetchVideos();
        setDeletingVideo(null);
        if (showModal && selectedVideo?.id === deletingVideo.id) {
          setShowModal(false);
        }
      } else {
        toast.error("Erro ao excluir vídeo");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir vídeo");
    }
  };

  const handleUpdatePassword = async (videoId, password, removePassword = false) => {
    try {
      const response = await fetch(`/api/portfolio/videos/${videoId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          removePassword ? { removePassword: true } : { password }
        ),
      });

      if (response.ok) {
        toast.success(
          removePassword
            ? "Senha removida com sucesso!"
            : "Senha atualizada com sucesso!"
        );
        fetchVideos();
        setEditingVideo(null);
      } else {
        toast.error("Erro ao atualizar senha");
      }
    } catch (error) {
      console.error("Update password error:", error);
      toast.error("Erro ao atualizar senha");
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="h-10 w-10 animate-spin border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <header className="border-b border-zinc-800/20 glass-panel px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

        <div className="flex items-center gap-6 relative z-10">
          <motion.div
            whileHover={{ x: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </motion.div>

          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="brick-title text-2xl md:text-4xl tracking-tighter uppercase leading-none mb-2"
            >
              Portfolio
            </motion.h1>
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-4 bg-red-600" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em] font-black">
                Vídeos Embedáveis • R2 Storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setViewMode("list")}
              className={`w-10 h-10 p-0 border rounded-none transition-colors ${viewMode === "list"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
            >
              <List className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => setViewMode("grid")}
              className={`w-10 h-10 p-0 border rounded-none transition-colors ${viewMode === "grid"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
            >
              <Grid className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="glass-button-primary border-none rounded-none px-6 h-10 font-black uppercase tracking-widest text-xs ml-2"
            >
              <Upload className="w-4 h-4 mr-3" />
              {uploading ? "Enviando..." : "Fazer Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {videos.length === 0 ? (
            <div className="glass-panel border border-zinc-800/30 rounded-none p-12 text-center">
              <div className="w-16 h-16 bg-zinc-900/50 flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="brick-tech text-[10px] text-zinc-500 uppercase tracking-widest">
                Nenhum vídeo no portfolio
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {videos.map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-panel border border-zinc-800/30 rounded-none p-4 hover:border-red-600/30 transition-all group cursor-pointer"
                  onClick={() => handleVideoClick(video)}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-32 h-18 flex-shrink-0 bg-zinc-900/50">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1 text-[10px] text-white">
                        {formatDuration(video.duration)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="brick-title text-sm text-white truncate">
                          {video.title}
                        </h4>
                        {video.is_password_protected && (
                          <Lock className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[9px] text-zinc-500 uppercase tracking-widest">
                        <span>{formatFileSize(video.file_size)}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {video.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Code className="w-3 h-3" />
                          {video.embed_count}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingVideo(video);
                        }}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(video);
                        }}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-panel border border-zinc-800/30 rounded-none overflow-hidden hover:border-red-600/30 transition-all group cursor-pointer"
                  onClick={() => handleVideoClick(video)}
                >
                  <div className="relative w-full aspect-video bg-zinc-900/50">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-zinc-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 text-[10px] text-white">
                      {formatDuration(video.duration)}
                    </div>
                    {video.is_password_protected && (
                      <div className="absolute top-2 right-2 bg-yellow-500/90 p-1">
                        <Lock className="w-3 h-3 text-black" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="brick-title text-xs text-white truncate mb-2">
                      {video.title}
                    </h4>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-widest">
                      <span>{formatFileSize(video.file_size)}</span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {video.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Code className="w-3 h-3" />
                          {video.embed_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {showModal && selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel border border-zinc-800/50 rounded-none max-w-6xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="brick-title text-xl text-white">
                    {selectedVideo.title}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Video Player */}
                  <div className="lg:col-span-2">
                    <div className="bg-black aspect-video">
                      <video
                        src={selectedVideo.direct_url}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  {/* Links */}
                  <div className="space-y-4">
                    <div className="glass-panel border border-zinc-800/30 rounded-none p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Code className="w-4 h-4 text-red-500" />
                        <h3 className="brick-title text-sm uppercase">
                          Link Direto
                        </h3>
                      </div>
                      <div className="relative">
                        <input
                          readOnly
                          value={selectedVideo.direct_url}
                          className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-zinc-400 pr-10"
                        />
                        <button
                          onClick={() =>
                            handleCopyLink(selectedVideo.direct_url, "direct")
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                        >
                          {copiedLink === "direct" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="glass-panel border border-zinc-800/30 rounded-none p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Code className="w-4 h-4 text-red-500" />
                        <h3 className="brick-title text-sm uppercase">
                          Código Embed
                        </h3>
                      </div>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={`<iframe src="${window.location.origin}/portfolio/embed/${selectedVideo.id}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`}
                          className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-zinc-400 h-24 resize-none pr-10"
                        />
                        <button
                          onClick={() =>
                            handleCopyLink(`<iframe src="${window.location.origin}/portfolio/embed/${selectedVideo.id}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`, "embed")
                          }
                          className="absolute right-2 top-2 text-zinc-400 hover:text-white"
                        >
                          {copiedLink === "embed" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="glass-panel border border-zinc-800/30 rounded-none p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="brick-title text-sm uppercase">
                          Proteção
                        </h3>
                        {selectedVideo.is_password_protected ? (
                          <Lock className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Unlock className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mb-3">
                        {selectedVideo.is_password_protected
                          ? "Vídeo protegido por senha"
                          : "Vídeo público"}
                      </p>
                      <Button
                        onClick={() => setEditingVideo(selectedVideo)}
                        size="sm"
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border-none"
                      >
                        <Edit3 className="w-3 h-3 mr-2" />
                        Editar Proteção
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Password Modal */}
      <AnimatePresence>
        {editingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel border border-zinc-800/50 rounded-none max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="brick-title text-lg text-white">
                  Proteção por Senha
                </h2>
                <button
                  onClick={() => setEditingVideo(null)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const password = e.target.password.value;
                  if (password) {
                    handleUpdatePassword(editingVideo.id, password);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-zinc-400 uppercase tracking-widest mb-2">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    name="password"
                    className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-sm text-white"
                    placeholder="Digite a senha"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none"
                  >
                    Salvar Senha
                  </Button>
                  {editingVideo.is_password_protected && (
                    <Button
                      type="button"
                      onClick={() =>
                        handleUpdatePassword(editingVideo.id, null, true)
                      }
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border-none"
                    >
                      Remover Senha
                    </Button>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel border border-zinc-800/50 rounded-none max-w-sm w-full p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="brick-title text-lg text-white mb-2">
                Excluir Vídeo?
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Tem certeza que deseja excluir &ldquo;{deletingVideo.title}&rdquo;? Esta ação não pode ser desfeita.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={() => setDeletingVideo(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border-none"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none"
                >
                  Excluir
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
