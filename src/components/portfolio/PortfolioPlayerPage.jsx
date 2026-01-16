import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Plyr from "plyr";
import { Lock, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "plyr/dist/plyr.css";

export function PortfolioPlayerPage() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const playerRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetchVideoData();
  }, [id]);

  const fetchVideoData = async () => {
    try {
      const response = await fetch(`/api/portfolio/videos/${id}/public`);

      if (!response.ok) {
        toast.error("Vídeo não encontrado");
        return;
      }

      const data = await response.json();
      setVideo(data.video);
      setIsPasswordProtected(data.video.is_password_protected);

      // If not password protected, mark as authenticated
      if (!data.video.is_password_protected) {
        setIsAuthenticated(true);
        trackView();
      }
    } catch (error) {
      console.error("Error fetching video:", error);
      toast.error("Erro ao carregar vídeo");
    } finally {
      setLoading(false);
    }
  };

  const trackView = async () => {
    try {
      await fetch(`/api/portfolio/videos/${id}/track-view`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsVerifyingPassword(true);

    try {
      const response = await fetch(`/api/portfolio/videos/${id}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.valid) {
        setIsAuthenticated(true);
        trackView();
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

  useEffect(() => {
    if (isAuthenticated && video && videoRef.current && !playerRef.current) {
      playerRef.current = new Plyr(videoRef.current, {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "duration",
          "mute",
          "volume",
          "settings",
          "fullscreen",
        ],
        settings: ["quality", "speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        quality: {
          default: 720,
          options: [1080, 720, 480],
        },
      });

      // Cleanup on unmount
      return () => {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }
  }, [isAuthenticated, video]);

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

  if (!video) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 uppercase tracking-[0.3em] font-black text-[10px]">
            Vídeo não encontrado
          </p>
        </div>
      </div>
    );
  }

  if (isPasswordProtected && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel border border-zinc-800/50 rounded-none p-8 max-w-md w-full"
        >
          {/* Logo/Branding */}
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
                Portfolio Player
              </p>
              <span className="h-[1px] w-8 bg-red-600" />
            </div>
          </div>

          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="w-5 h-5 text-yellow-500" />
              <h2 className="brick-title text-lg text-white uppercase">
                Vídeo Protegido
              </h2>
            </div>
            <p className="text-sm text-zinc-400">
              Este vídeo requer uma senha para ser visualizado.
            </p>
          </div>

          {video.thumbnail_url && (
            <div className="mb-6 relative">
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-full aspect-video object-cover opacity-50"
              />
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <Lock className="w-12 h-12 text-white" />
              </div>
            </div>
          )}

          <h3 className="brick-title text-xl text-white mb-6 text-center">
            {video.title}
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
              {isVerifyingPassword ? "Verificando..." : "Acessar Vídeo"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800/50">
            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest">
              <Eye className="w-3 h-3" />
              <span>{video.view_count || 0} visualizações</span>
            </div>
          </div>
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
            BRICK Review
          </motion.h1>
          <div className="flex items-center gap-2">
            <span className="h-[1px] w-4 bg-red-600" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">
              Portfolio Player
            </p>
          </div>
        </div>
      </header>

      {/* Video Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-zinc-800/50 rounded-none overflow-hidden"
          >
            {/* Video Title */}
            <div className="border-b border-zinc-800/50 p-4 md:p-6">
              <h2 className="brick-title text-lg md:text-xl text-white mb-2">
                {video.title}
              </h2>
              {video.description && (
                <p className="text-sm text-zinc-400">{video.description}</p>
              )}
            </div>

            {/* Video Player */}
            <div className="bg-black aspect-video">
              <video
                ref={videoRef}
                src={video.direct_url}
                className="w-full h-full"
                playsInline
              />
            </div>

            {/* Video Stats */}
            <div className="border-t border-zinc-800/50 p-4 bg-zinc-950/50">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <Eye className="w-3 h-3" />
                    {video.view_count || 0} visualizações
                  </span>
                  {video.duration && (
                    <span>
                      Duração: {Math.floor(video.duration / 60)}:
                      {String(Math.floor(video.duration % 60)).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <div className="text-zinc-600">
                  {new Date(video.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Powered by */}
          <div className="mt-6 text-center">
            <p className="text-[9px] text-zinc-700 uppercase tracking-[0.3em] font-black">
              Powered by BRICK Review • Video Review Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
