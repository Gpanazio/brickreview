import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Film, Folder, Play, MessageSquare, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '../player/VideoPlayer';

export function ShareViewPage() {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null); // Video being viewed in folder
  const [folderVideos, setFolderVideos] = useState([]); // Videos in the shared folder

  const fetchShare = async (pass = null) => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/shares/${token}${pass ? `?password=${pass}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && data.requires_password) {
          setShareData({ requires_password: true });
        } else {
          throw new Error(data.error || 'Erro ao carregar link');
        }
      } else {
        setShareData(data);

        // Se for uma pasta, buscar vídeos dentro dela
        if (data.resource?.type === 'folder') {
          fetchFolderVideos(data.resource.content.id);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderVideos = async (folderId) => {
    try {
      // Buscar vídeos da pasta sem autenticação (público)
      const response = await fetch(`/api/shares/${token}/folder-videos`);
      if (response.ok) {
        const videos = await response.json();
        setFolderVideos(videos);
      }
    } catch (err) {
      console.error('Erro ao buscar vídeos da pasta:', err);
    }
  };

  useEffect(() => {
    fetchShare();
  }, [token]);

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
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Este link exige uma senha de acesso</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input 
              type="password"
              placeholder="DIGITE A SENHA"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input h-12 rounded-none border-none text-center"
              required
            />
            <Button type="submit" className="w-full h-12 glass-button-primary border-none rounded-none font-black uppercase tracking-widest text-xs">
              Acessar Conteúdo
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const { resource } = shareData;

  // Se estiver vendo um vídeo específico em uma pasta compartilhada
  const currentVideo = selectedVideo || (resource?.type === 'video' ? resource.content : null);

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-white font-sans overflow-hidden flex flex-col">
      {/* Public Header */}
      <header className="h-16 border-b border-zinc-900 bg-black/40 backdrop-blur-md px-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-red-600 flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="brick-title text-sm tracking-tighter">BRICK <span className="text-red-500">SHARE</span></h1>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest leading-none">Review Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-zinc-800 text-[8px] uppercase tracking-widest text-zinc-400 rounded-none bg-zinc-900/50 h-6">
            <Film className="w-3 h-3 mr-1" />
            {resource?.type === 'folder' ? `${folderVideos.length} vídeos` : 'Compartilhamento'}
          </Badge>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Glow Effect */}
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-red-600/5 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto space-y-8 relative z-10">
          {/* Resource Title & Breadcrumbs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              <span>Compartilhamento</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-red-500">{resource.type}</span>
            </div>
            <h2 className="brick-title text-4xl tracking-tighter text-white">{resource.content.name || resource.content.title}</h2>
            <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">{resource.content.description || 'Nenhuma descrição disponível.'}</p>
          </div>

          {/* Conditional Rendering based on Resource Type */}
          {currentVideo ? (
            <div className="space-y-4">
              {/* Back button if viewing video in folder */}
              {resource.type === 'folder' && selectedVideo && (
                <Button
                  variant="ghost"
                  onClick={() => setSelectedVideo(null)}
                  className="text-zinc-400 hover:text-white text-xs uppercase tracking-widest"
                >
                  <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
                  Voltar para pasta
                </Button>
              )}

              <div className="w-full flex items-center justify-center bg-black border border-zinc-800 shadow-2xl p-4">
                <div className="w-full max-w-6xl">
                  <VideoPlayer
                    video={currentVideo}
                    isPublic={true}
                    shareToken={token}
                    accessType={shareData.access_type}
                  />
                </div>
              </div>
            </div>
          ) : resource.type === 'folder' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {folderVideos.length === 0 ? (
                <div className="col-span-full bg-zinc-900/20 border border-zinc-800 p-12 text-center">
                  <Folder className="w-12 h-12 text-red-600 mx-auto mb-4 opacity-50" />
                  <p className="text-zinc-500 text-sm italic">Esta pasta não contém vídeos.</p>
                </div>
              ) : (
                folderVideos.map((video) => (
                  <Card
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className="glass-panel border-zinc-800 rounded-none overflow-hidden hover:border-red-600/50 transition-all cursor-pointer group"
                  >
                    <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-12 h-12 text-zinc-700" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-16 h-16 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="brick-title text-sm tracking-tighter text-white truncate">{video.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {video.comments_count || 0}
                        </span>
                        {video.duration && (
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="col-span-full bg-zinc-900/20 border border-zinc-800 p-12 text-center">
              <Play className="w-12 h-12 text-red-600 mx-auto mb-4 opacity-50" />
              <p className="text-zinc-500 text-sm italic">O conteúdo deste compartilhamento está pronto para revisão.</p>
            </div>
          )}
        </div>
      </main>
      
      <footer className="py-6 border-t border-zinc-900 bg-black/20 text-center">
        <p className="text-[8px] text-zinc-600 uppercase tracking-[0.4em]">Powered by BRICK Systems</p>
      </footer>
    </div>
  );
}
