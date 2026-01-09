import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { VideoPlayer } from '../player/VideoPlayer';
import { FolderView } from './FolderView';
import { Button } from '@/components/ui/button';
import { formatVideoDuration } from '../../utils/time';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Upload, Play, Clock, MessageSquare,
  CheckCircle2, Plus, MoreVertical, FileVideo, LayoutGrid, FolderTree
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'folders'
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchProjectDetails();
    fetchFolders();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProject(data);
    } catch (error) {
      console.error('Erro ao buscar detalhes do projeto:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch(`/api/folders/project/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFolders(data);
    } catch (error) {
      console.error('Erro ao buscar pastas:', error);
    }
  };

  const handleCreateFolder = async (name, parentFolderId = null) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: parseInt(id),
          parent_folder_id: parentFolderId,
          name
        })
      });

      if (response.ok) {
        fetchFolders();
      }
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const uploadToast = toast.loading('Enviando vídeo...');
    const formData = new FormData();
    formData.append('video', file);
    formData.append('project_id', id);
    formData.append('title', file.name.split('.')[0]);

    try {
      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        toast.success('Vídeo enviado com sucesso!', { id: uploadToast });
        fetchProjectDetails();
      } else {
        const errorData = await response.json().catch((parseError) => {
          console.error('Error parsing server response:', parseError);
          return {};
        });
        toast.error(errorData.error || 'Erro no upload', { id: uploadToast });
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar vídeo', { id: uploadToast });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050505]">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!project) return <div className="p-8 text-white">Projeto não encontrado</div>;

  if (selectedVideo) {
    return (
      <VideoPlayer 
        video={selectedVideo} 
        onBack={() => {
          setSelectedVideo(null);
          fetchProjectDetails();
        }} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header do Projeto */}
      <header className="border-b border-zinc-800/20 glass-panel px-8 py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />
        
        <div className="flex items-center gap-6 relative z-10">
          <motion.div
            whileHover={{ x: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Link to="/" className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50">
              <ChevronLeft className="w-6 h-6" />
            </Link>
          </motion.div>

          <div className="flex-1">
            <motion.h1 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="brick-title text-4xl tracking-tighter uppercase leading-none mb-2"
            >
              {project.name}
            </motion.h1>
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-4 bg-red-600" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black">
                Cliente: <span className="text-zinc-300">{project.client_name || 'N/A'}</span> • {project.videos?.length || 0} Entregáveis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex bg-zinc-950/50 p-1 border border-zinc-800/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-9 h-9 flex items-center justify-center transition-all ${
                  viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('folders')}
                className={`w-9 h-9 flex items-center justify-center transition-all ${
                  viewMode === 'folders' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <FolderTree className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              id="video-upload"
              className="hidden"
              accept="video/*"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button
              asChild
              className="glass-button-primary border-none rounded-none px-6 py-6 h-auto font-black uppercase tracking-widest text-xs"
              disabled={uploading}
            >
              <label htmlFor="video-upload" className="cursor-pointer flex items-center">
                {uploading ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent mr-3" 
                  />
                ) : (
                  <Upload className="w-4 h-4 mr-3" />
                )}
                {uploading ? 'Processando...' : 'Novo Vídeo'}
              </label>
            </Button>
          </div>
        </div>
      </header>

      {/* Lista de Vídeos */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {viewMode === 'folders' ? (
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
                currentFolderId={currentFolderId}
                onFolderClick={(folder) => setCurrentFolderId(folder.id)}
                onVideoClick={(video) => setSelectedVideo(video)}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={fetchFolders}
                onDeleteFolder={fetchFolders}
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
              {!project.videos || project.videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 border border-dashed border-zinc-800 bg-zinc-950/10">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                    <FileVideo className="w-8 h-8 text-zinc-700" />
                  </div>
                  <p className="text-zinc-600 uppercase tracking-[0.4em] font-black text-[10px]">Aguardando primeiro upload</p>
                </div>
              ) : (
                <motion.div 
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.08 }
                    }
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                >
                  {project.videos.map((video) => (
                    <motion.div
                      key={video.id}
                      variants={{
                        hidden: { opacity: 0, scale: 0.95 },
                        show: { opacity: 1, scale: 1 }
                      }}
                    >
                      <VideoCard
                        video={video}
                        onClick={() => setSelectedVideo(video)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function VideoCard({ video, onClick }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-600';
      case 'changes_requested': return 'bg-amber-600';
      default: return 'bg-zinc-600';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'changes_requested': return 'Ajustes';
      default: return 'Pendente';
    }
  };

  return (
    <div 
      onClick={onClick}
      className="group glass-card border-none rounded-none overflow-hidden cursor-pointer relative flex flex-col h-full"
    >
      <div className="aspect-video bg-zinc-900 relative overflow-hidden flex-shrink-0">
        <img 
          src={video.thumbnail_url || 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400'} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          alt={video.title}
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
        </div>
        
        {/* Status Badge Overlay */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 ${getStatusColor(video.latest_approval_status)} text-[8px] font-black text-white uppercase tracking-[0.2em] shadow-lg`}>
          {getStatusLabel(video.latest_approval_status)}
        </div>

        {/* Duração Overlay */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-black text-white uppercase tracking-tighter">
          {formatVideoDuration(video.duration)}
        </div>
      </div>
      
      <div className="p-5 border-l-2 border-l-transparent group-hover:border-l-red-600 transition-all flex-1 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="brick-title text-sm text-white truncate mb-1">{video.title}</h3>
            <p className="brick-manifesto text-[10px] text-zinc-500 truncate">Versão final para aprovação do cliente</p>
          </div>
          <button className="text-zinc-700 hover:text-white transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-zinc-600" />
              <span className="brick-tech text-[9px] text-zinc-500 uppercase">{video.comments_count || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-red-900/50" />
              <span className="brick-tech text-[9px] text-red-600/80 uppercase">V{video.version_number}</span>
            </div>
          </div>
          <div className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
