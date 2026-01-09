import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Upload, Play, Clock, MessageSquare, 
  CheckCircle2, Plus, MoreVertical, FileVideo 
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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    fetchProjectDetails();
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
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
        fetchProjectDetails();
      } else {
        alert('Erro no upload');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
    } finally {
      setUploading(false);
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

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header do Projeto */}
      <header className="border-b border-zinc-800/50 glass-panel px-8 py-6">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="brick-title text-3xl tracking-tighter uppercase">{project.name}</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-1">
              Client: {project.client_name || 'N/A'} • {project.videos?.length || 0} Videos
            </p>
          </div>
          <div className="flex items-center gap-3">
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
              className="glass-button-primary border-none rounded-none"
              disabled={uploading}
            >
              <label htmlFor="video-upload" className="cursor-pointer flex items-center">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {uploading ? 'Uploading...' : 'Upload Video'}
              </label>
            </Button>
          </div>
        </div>
      </header>

      {/* Lista de Vídeos */}
      <div className="flex-1 overflow-y-auto p-8">
        {!project.videos || project.videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-800">
            <FileVideo className="w-12 h-12 text-zinc-800 mb-4" />
            <p className="text-zinc-500 uppercase tracking-widest font-bold text-sm">No videos in this project</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {project.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCard({ video }) {
  return (
    <div className="group glass-card border-none rounded-none overflow-hidden cursor-pointer relative">
      <div className="aspect-video bg-zinc-900 relative overflow-hidden">
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
        
        {/* Duração Overlay */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-black text-white uppercase tracking-tighter">
          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
        </div>
      </div>
      
      <div className="p-4 border-l-2 border-l-transparent group-hover:border-l-red-600 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="brick-title text-sm text-white truncate uppercase tracking-tighter">{video.title}</h3>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> {video.comments_count || 0}
              </span>
              <span className="flex items-center gap-1 text-red-500/80">
                <Clock className="w-3 h-3" /> v{video.version_number}
              </span>
            </div>
          </div>
          <button className="text-zinc-600 hover:text-white transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
