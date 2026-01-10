import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { ProjectCoverPlaceholder } from '@/components/ui/ProjectCoverPlaceholder';

export function ProjectListItem({ project, onProjectUpdate }) {
  const [showSettings, setShowSettings] = useState(false);
  const { token } = useAuth();

  const updatedAt = project.updated_at ? new Date(project.updated_at).toLocaleDateString() : project.updatedAt;
  const createdAt = project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A';

  return (
    <>
      <div className="group flex items-center px-6 py-4 hover:bg-zinc-900/50 transition-colors border-l-2 border-transparent hover:border-l-red-600 relative">
        <Link to={`/project/${project.id}`} className="flex-1 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-6 flex items-center gap-4">
            <div className="relative w-12 h-8 bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-800">
              {project.cover_image_url || project.thumbnail_url || project.thumbnail ? (
                <img
                  src={project.cover_image_url || project.thumbnail_url || project.thumbnail}
                  alt={project.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              
              <ProjectCoverPlaceholder 
                className={`absolute inset-0 ${(project.cover_image_url || project.thumbnail_url || project.thumbnail) ? 'hidden' : 'flex'}`}
                projectName={project.name}
                clientName={project.client_name}
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-red-500 transition-colors">{project.name}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{project.client_name || "Brick Production"}</p>
            </div>
          </div>
          <div className="col-span-3 text-xs text-zinc-400 font-mono">
            {updatedAt}
          </div>
          <div className="col-span-3 text-xs text-zinc-400 font-mono">
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
