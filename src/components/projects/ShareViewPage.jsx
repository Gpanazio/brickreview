import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Film,
  Folder,
  Play,
  MessageSquare,
  ChevronRight,
  Lock,
  Share2,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "../player/VideoPlayer";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

export function ShareViewPage() {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null); // Video being viewed in folder/project
  const [videos, setVideos] = useState([]); // Videos in the shared folder or project

  const fetchShare = async (pass = null) => {
    try {
      setLoading(true);
      setError(null);

      const headers = pass ? { "x-share-password": pass } : {};
      const response = await fetch(`/api/shares/${token}`, { headers });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && data.requires_password) {
          setShareData({ requires_password: true });
          setPasswordError(!!pass);
        } else {
          throw new Error(data.error || "Erro ao carregar link");
        }
      } else {
        setPasswordError(false);
        setShareData(data);

        // Se for uma pasta ou projeto, buscar vídeos
        if (data.resource?.type === "folder") {
          fetchFolderVideos();
        } else if (data.resource?.type === "project") {
          fetchProjectVideos();
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderVideos = async () => {
    try {
      const headers = password ? { "x-share-password": password } : {};
      const response = await fetch(`/api/shares/${token}/folder-videos`, { headers });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        console.error("Erro ao buscar vídeos da pasta:", data);
        setVideos([]);
        return;
      }

      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar vídeos da pasta:", err);
      setVideos([]);
    }
  };

  const fetchProjectVideos = async () => {
    try {
      const headers = password ? { "x-share-password": password } : {};
      const response = await fetch(`/api/shares/${token}/project-videos`, { headers });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        console.error("Erro ao buscar vídeos do projeto:", data);
        setVideos([]);
        return;
      }

      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar vídeos do projeto:", err);
      setVideos([]);
    }
  };

  useEffect(() => {
    fetchShare();
  }, [token]);

  const handleDownloadVideo = async (videoId, type) => {
    const loadingToast = toast.loading("Gerando link de download...");
    try {
      const headers = password ? { "x-share-password": password } : {};
      const endpoint = `/api/shares/${token}/video/${videoId}/download?type=${type}`;

      const response = await fetch(endpoint, { headers });
      if (response.ok) {
        const data = await response.json();

        // Força download
        const videoResponse = await fetch(data.url);
        const blob = await videoResponse.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();

        toast.success("Download iniciado", { id: loadingToast });

        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } else {
        toast.error("Erro ao baixar arquivo", { id: loadingToast });
      }
    } catch (err) {
      console.error("Erro no download:", err);
      toast.error("Erro ao processar download", { id: loadingToast });
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    fetchShare(password);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0e] flex items-center justify-center text-white font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-red-600 border-t-transparent"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0e] flex flex-col items-center justify-center text-white p-4 font-sans text-center">
        <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-600/20">
          <Share2 className="text-red-500 w-8 h-8" />
        </div>
        <h1 className="brick-title text-2xl mb-2">LINK INVÁLIDO</h1>
        <p className="text-zinc-500 text-sm max-w-xs">{error}</p>
        <Button variant="link" className="mt-6 text-red-500" asChild>
          <Link to="/login">Ir para Login</Link>
        </Button>
      </div>
    );
  }

  if (shareData?.requires_password) {
    return (
      <div className="min-h-screen bg-[#0d0d0e] flex items-center justify-center p-4 font-sans text-white">
        <Card className="w-full max-w-sm glass-panel border-zinc-800/50 p-8 rounded-none">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-zinc-400" />
            </div>
            <h1 className="brick-title text-xl tracking-tighter">LINK PROTEGIDO</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
              Este link exige uma senha de acesso
            </p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="DIGITE A SENHA"
              value={password}
              onChange={(e) => {
                setPasswordError(false);
                setPassword(e.target.value);
              }}
              className="glass-input h-12 rounded-none border-none text-center"
              required
            />
            {passwordError && <p className="text-xs text-red-500 text-center">Senha incorreta</p>}
            <Button
              type="submit"
              className="w-full h-12 glass-button-primary border-none rounded-none font-black uppercase tracking-widest text-xs"
            >
              Acessar Conteúdo
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const { resource } = shareData;

  let currentVideo = selectedVideo || (resource?.type === "video" ? resource.content : null);
  let currentVersions = [];

  if (resource?.type === "video" && resource.versions && resource.versions.length > 0) {
    const allVideos = resource.versions;
    if (currentVideo.parent_video_id) {
      const parentVideo = allVideos.find((v) => !v.parent_video_id);
      const childVersions = allVideos.filter((v) => v.parent_video_id);
      if (parentVideo) {
        currentVideo = parentVideo;
        currentVersions = childVersions;
      }
    } else {
      currentVersions = allVideos;
    }
  }

  return (
    <div className="h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col">
      {/* Public Header */}
      <header className="h-14 border-b border-zinc-900 bg-[#0a0a0a] px-4 md:px-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 md:gap-4 flex-none">
          <div className="w-8 h-8 bg-red-600 flex items-center justify-center flex-shrink-0">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="brick-title text-sm tracking-tighter uppercase">
              BRICK <span className="text-red-500">SHARE</span>
            </h1>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest leading-none">
              Review Mode
            </p>
          </div>
        </div>

        <div className="flex-1 px-4 md:px-8 overflow-hidden">
          <h2 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 truncate text-center md:text-left">
            {resource.content.name || resource.content.title}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <Badge
            variant="outline"
            className="border-zinc-800 text-[8px] uppercase tracking-widest text-zinc-400 rounded-none bg-zinc-900/50 h-6"
          >
            <Film className="w-3 h-3 mr-1" />
            {resource?.type === "folder" || resource?.type === "project"
              ? `${videos.length} vídeos`
              : "Compartilhamento"}
          </Badge>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {currentVideo ? (
          <div className="w-full h-full flex flex-col">
            {/* Action Bar */}
            {(resource.type === "folder" || resource.type === "project") && selectedVideo && (
              <div className="bg-zinc-950 border-b border-zinc-900 px-4 py-2 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedVideo(null)}
                  className="text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest h-7 rounded-none"
                >
                  <ChevronRight className="w-3 h-3 rotate-180 mr-2" />
                  Voltar para lista
                </Button>
              </div>
            )}

            <div className="flex-1 relative">
              <VideoPlayer
                video={currentVideo}
                versions={currentVersions}
                isPublic={true}
                shareToken={token}
                sharePassword={password || null}
                accessType={shareData.access_type}
              />
            </div>
          </div>
        ) : resource.type === "folder" || resource.type === "project" ? (
          <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
              <div className="space-y-2 border-l-2 border-red-600 pl-4 md:pl-6 py-2">
                <div className="flex items-center gap-2 text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-500 font-black">
                  <span>Compartilhamento</span>
                  <ChevronRight className="w-3 h-3 text-red-600" />
                  <span className="text-zinc-300">{resource.type}</span>
                </div>
                <h2 className="brick-title text-2xl md:text-4xl tracking-tighter text-white uppercase">
                  {resource.content.name || resource.content.title}
                </h2>
                {resource.content.description && (
                  <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed italic">
                    {resource.content.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.length === 0 ? (
                  <div className="col-span-full bg-zinc-900/20 border border-zinc-800 p-12 text-center">
                    <Folder className="w-12 h-12 text-red-600 mx-auto mb-4 opacity-50" />
                    <p className="text-zinc-500 text-sm italic">
                      {resource.type === "folder"
                        ? "Esta pasta não contém vídeos."
                        : "Este projeto não contém vídeos."}
                    </p>
                  </div>
                ) : (
                  videos.map((video) => (
                    <ContextMenu key={video.id}>
                      <ContextMenuTrigger>
                        <Card
                          onClick={() => setSelectedVideo(video)}
                          className="glass-panel border-zinc-800 rounded-none overflow-hidden hover:border-red-600/50 transition-all cursor-pointer group bg-zinc-900/20 h-full"
                        >
                          <div className="aspect-video bg-zinc-950 relative overflow-hidden">
                            {video.thumbnail_url ? (
                              <img
                                src={video.thumbnail_url}
                                alt={video.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-12 h-12 text-zinc-800" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-12 h-12 bg-red-600 flex items-center justify-center">
                                <Play className="w-6 h-6 text-white fill-current" />
                              </div>
                            </div>
                          </div>
                          <div className="p-4 border-l-2 border-l-transparent group-hover:border-l-red-600 transition-all">
                            <h3 className="brick-title text-xs tracking-tighter text-white truncate uppercase">
                              {video.title}
                            </h3>
                            <div className="flex items-center gap-3 mt-2 text-[8px] text-zinc-500 uppercase font-black tracking-widest">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-red-600" />
                                {video.comments_count || 0}
                              </span>
                              {video.duration && (
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" />
                                  {Math.floor(video.duration / 60)}:
                                  {String(Math.floor(video.duration % 60)).padStart(2, "0")}
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
                        <ContextMenuItem
                          onClick={() => setSelectedVideo(video)}
                          className="focus:bg-red-600 focus:text-white cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Play className="w-3 h-3 mr-2" />
                          Abrir Vídeo
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => handleDownloadVideo(video.id, "original")}
                          className="focus:bg-red-600 focus:text-white cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Download className="w-3 h-3 mr-2" />
                          Baixar Original
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => handleDownloadVideo(video.id, "proxy")}
                          className="focus:bg-red-600 focus:text-white cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Download className="w-3 h-3 mr-2" />
                          Baixar Proxy (720p)
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Play className="w-12 h-12 text-red-600 mx-auto mb-4 opacity-50" />
              <p className="text-zinc-500 text-sm italic">
                O conteúdo deste compartilhamento está pronto para revisão.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
