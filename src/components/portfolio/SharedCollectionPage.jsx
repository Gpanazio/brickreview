import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, Folder, Film, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SharedCollectionPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [shareInfo, setShareInfo] = useState(null);
  const [collection, setCollection] = useState(null);
  const [videos, setVideos] = useState([]);
  const [subcollections, setSubcollections] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentCollectionId, setCurrentCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  useEffect(() => {
    fetchShareInfo();
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && shareInfo) {
      fetchCollectionVideos(currentCollectionId);
    }
  }, [isAuthenticated, currentCollectionId, shareInfo]);

  const fetchShareInfo = async () => {
    try {
      const response = await fetch(`/api/portfolio/shares/${token}`);

      if (!response.ok) {
        toast.error("Link de compartilhamento inválido ou expirado");
        return;
      }

      const data = await response.json();
      setShareInfo(data);

      if (!data.requires_password) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error fetching share info:", error);
      toast.error("Erro ao carregar compartilhamento");
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionVideos = async (collectionId) => {
    try {
      const url = collectionId
        ? `/api/portfolio/shares/${token}/collection-videos?collection_id=${collectionId}`
        : `/api/portfolio/shares/${token}/collection-videos`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setCollection(data.collection);
        setVideos(data.videos || []);
        setSubcollections(data.subcollections || []);
      }
    } catch (error) {
      console.error("Error fetching collection videos:", error);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsVerifyingPassword(true);

    try {
      const response = await fetch(`/api/portfolio/shares/${token}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.valid) {
        setIsAuthenticated(true);
        toast.success("Acesso liberado!");
      } else {
        toast.error("Senha incorreta");
        setPassword("");
      }
    } catch (error) {
      console.error("Error verifying password:", error);
      toast.error("Erro ao verificar senha");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleVideoClick = (video) => {
    navigate(`/portfolio/player/${video.id}`);
  };

  const handleCollectionClick = (subcollection) => {
    setCurrentCollectionId(subcollection.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin border-4 border-red-600 border-t-transparent" />
          <p className="text-zinc-500 uppercase tracking-[0.3em] font-black text-[10px]">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (!shareInfo) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 uppercase tracking-[0.3em] font-black text-[10px]">
            Compartilhamento não encontrado
          </p>
        </div>
      </div>
    );
  }

  if (shareInfo.requires_password && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel border border-zinc-800/50 rounded-none p-8 max-w-md w-full"
        >
          <div className="mb-8 text-center">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="brick-title text-3xl tracking-tighter uppercase mb-2"
            >
              BRICK Review
            </motion.h1>
            <div className="flex items-center justify-center gap-2">
              <span className="h-[1px] w-8 bg-red-600" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">
                Portfolio Collection
              </p>
              <span className="h-[1px] w-8 bg-red-600" />
            </div>
          </div>

          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="w-5 h-5 text-yellow-500" />
              <h2 className="brick-title text-lg text-white uppercase">
                Coleção Protegida
              </h2>
            </div>
            <p className="text-sm text-zinc-400">
              Esta coleção requer uma senha para ser visualizada.
            </p>
          </div>

          <h3 className="brick-title text-xl text-white mb-6 text-center">
            {shareInfo.resource?.name || "Coleção"}
          </h3>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">
                Senha de Acesso
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="glass-input border-none rounded-none h-12 text-white"
                required
                disabled={isVerifyingPassword}
              />
            </div>

            <Button
              type="submit"
              disabled={isVerifyingPassword || !password}
              className="w-full glass-button-primary border-none rounded-none h-12 font-black uppercase tracking-widest"
            >
              {isVerifyingPassword ? "Verificando..." : "Acessar Coleção"}
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/20 glass-panel px-4 py-4 md:px-8 md:py-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

        <div className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="brick-title text-xl md:text-2xl tracking-tighter uppercase leading-none mb-2"
          >
            {collection?.name || shareInfo.resource?.name || "Coleção"}
          </motion.h1>
          <div className="flex items-center gap-2">
            <span className="h-[1px] w-4 bg-red-600" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">
              Portfolio Collection • {videos.length} vídeos
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Subcollections Grid */}
          {subcollections.length > 0 && (
            <div className="mb-8">
              <h2 className="brick-title text-sm text-zinc-400 mb-4 uppercase tracking-widest">
                Pastas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {subcollections.map((subcollection) => (
                  <motion.div
                    key={subcollection.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleCollectionClick(subcollection)}
                    className="glass-panel border border-zinc-800/30 rounded-none p-4 hover:border-red-600/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Folder className="w-5 h-5 text-red-500" />
                      <span className="brick-title text-sm text-white truncate">
                        {subcollection.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                      {subcollection.videos_count} vídeos
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Videos Grid */}
          {videos.length > 0 ? (
            <div>
              <h2 className="brick-title text-sm text-zinc-400 mb-4 uppercase tracking-widest">
                Vídeos
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((video) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleVideoClick(video)}
                    className="glass-panel border border-zinc-800/30 rounded-none overflow-hidden hover:border-red-600/30 transition-all group cursor-pointer"
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
                        <ChevronRight className="w-12 h-12 text-white" />
                      </div>
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 text-[10px] text-white">
                          {Math.floor(video.duration / 60)}:
                          {String(Math.floor(video.duration % 60)).padStart(2, "0")}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="brick-title text-xs text-white truncate mb-2">
                        {video.title}
                      </h4>
                      <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {video.view_count || 0}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border border-zinc-900 bg-zinc-950/20">
              <p className="text-zinc-500 uppercase tracking-[0.3em] font-black text-[10px]">
                Nenhum vídeo nesta coleção
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800/20 p-4 text-center">
        <p className="text-[9px] text-zinc-700 uppercase tracking-[0.3em] font-black">
          Powered by BRICK Review • Video Review Platform
        </p>
      </div>
    </div>
  );
}
