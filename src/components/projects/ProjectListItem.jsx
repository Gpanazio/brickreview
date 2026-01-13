import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { ProjectCoverPlaceholder } from '@/components/ui/ProjectCoverPlaceholder';

// Helper para verificar se a URL é a antiga padrão do Unsplash
const isDefaultUrl = (url) => {
  return url && url.includes('images.unsplash.com/photo-1574267432644');
};

export function ProjectListItem({ project, onProjectUpdate }) {
  const [showSettings, setShowSettings] = useState(false);
  const { token } = useAuth();

  const updatedAt = project.updated_at ? new Date(project.updated_at).toLocaleDateString() : project.updatedAt;
  const createdAt = project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A';

  // Determina se deve mostrar a imagem ou o placeholder
  const coverUrl = project.cover_image_url || project.thumbnail_url || project.thumbnail;
  const hasValidCover = coverUrl && !isDefaultUrl(coverUrl);
  const [imageError, setImageError] = useState(false);

  return (
    <>
      <div className="group flex items-center px-4 md:px-6 py-4 hover:bg-zinc-900/50 transition-colors border-l-2 border-transparent hover:border-l-red-600 relative">
        <Link to={`/project/${project.id}`} className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center min-w-0">
          <div className="md:col-span-6 flex items-center gap-4 min-w-0">
            <div className="relative w-12 h-8 flex-shrink-0 overflow-hidden border border-zinc-800 bg-zinc-950">
              {hasValidCover && !imageError ? (
                <img
                  src={coverUrl}
                  alt={project.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <ProjectCoverPlaceholder 
                  className="w-full h-full"
                  projectName={project.name}
                  clientName={project.client_name}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white group-hover:text-red-500 transition-colors truncate">{project.name}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider truncate">{project.client_name || "Brick Production"}</p>
            </div>
          </div>
          <div className="md:col-span-3 text-[10px] md:text-xs text-zinc-500 md:text-zinc-400 font-mono">
            <span className="md:hidden">Atualizado em: </span>{updatedAt}
          </div>
          <div className="hidden md:block md:col-span-3 text-xs text-zinc-400 font-mono">
            {createdAt}
          </div>
        </Link>

        <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-zinc-800 rounded-none transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSettings(true);
            }}
          >
            <Settings className="w-4 h-4 text-zinc-500 hover:text-white" />
          </Button>
        </div>
      </div>

      {/* Modal de Configurações */}
      {showSettings && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettings(false)}
          onProjectUpdate={onProjectUpdate}
          token={token}
        />
      )}
    </>
  );
}
