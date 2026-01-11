import { useMemo, useState } from 'react';
import { Folder, FolderOpen, File, FileImage, FileText, FileAudio, Plus, MoreVertical, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatVideoDuration } from '../../utils/time';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper para formatar tamanho de arquivo
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper para ícone baseado no tipo de arquivo
const getFileIcon = (fileType) => {
  switch (fileType) {
    case 'image': return FileImage;
    case 'audio': return FileAudio;
    case 'document': return FileText;
    default: return File;
  }
};

// Helper para cor baseada no tipo de arquivo
const getFileColor = (fileType) => {
  switch (fileType) {
    case 'image': return 'text-green-400';
    case 'audio': return 'text-purple-400';
    case 'document': return 'text-orange-400';
    default: return 'text-zinc-400';
  }
};

export function FolderView({
  folders,
  videos = [],
  files = [],
  projects = [],
  currentFolderId,
  onFolderClick,
  onVideoClick,
  onProjectClick,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onMoveVideo,
  onMoveProject,
  onFileDelete,
  token
}) {
  const normalizedFolders = Array.isArray(folders) ? folders : [];
  const normalizedVideos = Array.isArray(videos) ? videos : [];
  const normalizedFiles = Array.isArray(files) ? files : [];
  const normalizedProjects = Array.isArray(projects) ? projects : [];
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newSubfolderParent, setNewSubfolderParent] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  // Filtra pastas do nível atual
  const currentLevelFolders = normalizedFolders.filter(f =>
    f.parent_folder_id === currentFolderId ||
    (!currentFolderId && f.parent_folder_id === null)
  );

  // Filtra vídeos do nível atual
  const currentLevelVideos = normalizedVideos.filter(v =>
    v.folder_id === currentFolderId ||
    (!currentFolderId && v.folder_id === null)
  );

  // Filtra arquivos do nível atual
  const currentLevelFiles = normalizedFiles.filter(f =>
    f.folder_id === currentFolderId ||
    (!currentFolderId && f.folder_id === null)
  );

  // Filtra projetos do nível atual
  const currentLevelProjects = normalizedProjects.filter(p =>
    p.folder_id === currentFolderId ||
    (!currentFolderId && p.folder_id === null)
  );

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleRenameStart = (folder) => {
    setRenamingFolder(folder.id);
    setNewFolderName(folder.name);
  };

  const handleRenameSubmit = async (folderId) => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newFolderName })
      });

      if (response.ok) {
        onRenameFolder();
        setRenamingFolder(null);
        setNewFolderName('');
      }
    } catch (error) {
      console.error('Erro ao renomear pasta:', error);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!confirm('Tem certeza que deseja excluir esta pasta? Todas as subpastas serão excluídas e os vídeos ficarão sem pasta.')) return;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        onDeleteFolder();
      }
    } catch (error) {
      console.error('Erro ao excluir pasta:', error);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Arquivo excluído');
        onFileDelete?.();
      }
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      toast.error('Erro ao excluir arquivo');
    }
  };

  const handleCreateFolder = async (parentFolderId = null) => {
    const folderName = prompt(parentFolderId ? 'Nome da subpasta:' : 'Nome da nova pasta:');
    if (!folderName || !folderName.trim()) return;

    await onCreateFolder(folderName, parentFolderId);
    setCreatingFolder(false);
    setNewSubfolderParent(null);
  };

  const handleFolderDragOver = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('video') || e.dataTransfer.types.includes('project')) {
      setDragOverFolder(folderId);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleFolderDragLeave = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFolder === folderId) {
      setDragOverFolder(null);
    }
  };

  const handleFolderDrop = async (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);

    try {
      const videoData = e.dataTransfer.getData('video');
      if (videoData) {
        const video = JSON.parse(videoData);
        await onMoveVideo?.(video.id, folderId);
        return;
      }

      const projectData = e.dataTransfer.getData('project');
      if (projectData) {
        const project = JSON.parse(projectData);
        await onMoveProject?.(project.id, folderId);
      }
    } catch (error) {
      console.error('Erro ao processar drop na pasta:', error);
    }
  };

  const renderFileItem = (file, depth = 0) => {
    const FileIcon = getFileIcon(file.file_type);
    const colorClass = getFileColor(file.file_type);

    return (
      <div
        key={`file-${file.id}`}
        style={{ marginLeft: `${depth * 20}px` }}
        className="group flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/50 rounded-none border-l-2 border-l-transparent hover:border-l-green-600 transition-all"
      >
        <FileIcon className={`w-4 h-4 ${colorClass}`} />
        <span className="flex-1 text-sm text-zinc-400 hover:text-white uppercase tracking-tight truncate">
          {file.name}
        </span>
        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
          {formatFileSize(file.file_size)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-all p-1">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="glass-panel border-zinc-800 rounded-none">
            <DropdownMenuItem
              className="text-xs uppercase tracking-wider cursor-pointer"
              onClick={() => window.open(file.r2_url, '_blank')}
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Abrir
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs uppercase tracking-wider text-red-500 cursor-pointer"
              onClick={() => handleDeleteFile(file.id)}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderFolder = (folder, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const subfolders = normalizedFolders.filter(f => f.parent_folder_id === folder.id);
    const folderVideos = normalizedVideos.filter(v => v.folder_id === folder.id);
    const folderFiles = normalizedFiles.filter(f => f.folder_id === folder.id);
    const folderProjects = normalizedProjects.filter(p => p.folder_id === folder.id);
    const isDragOver = dragOverFolder === folder.id;

    return (
      <div key={folder.id} style={{ marginLeft: `${depth * 20}px` }}>
        <div
          className={`group flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/50 rounded-none border-l-2 transition-all ${
            isDragOver ? 'border-l-blue-500 bg-blue-900/20' : 'border-l-transparent hover:border-l-red-600'
          }`}
          onDragOver={(e) => handleFolderDragOver(e, folder.id)}
          onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
          onDrop={(e) => handleFolderDrop(e, folder.id)}
        >
          <button
            onClick={() => toggleFolder(folder.id)}
            className="text-zinc-400 hover:text-white"
          >
            {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
          </button>

          {renamingFolder === folder.id ? (
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => handleRenameSubmit(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(folder.id);
                if (e.key === 'Escape') setRenamingFolder(null);
              }}
              className="flex-1 bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-white focus:outline-none focus:border-red-600"
              autoFocus
            />
          ) : (
            <button
              onClick={() => onFolderClick(folder)}
              className="flex-1 text-left text-sm text-zinc-300 hover:text-white font-medium uppercase tracking-tight"
            >
              {folder.name}
            </button>
          )}

          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
            {(folder.videos_count || 0) + folderFiles.length + (folder.projects_count || folderProjects.length)} itens
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-all p-1">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-panel border-zinc-800 rounded-none">
              <DropdownMenuItem
                className="text-xs uppercase tracking-wider cursor-pointer"
                onClick={() => handleCreateFolder(folder.id)}
              >
                <Plus className="w-3 h-3 mr-2" />
                Nova Subpasta
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs uppercase tracking-wider cursor-pointer"
                onClick={() => handleRenameStart(folder)}
              >
                <Edit className="w-3 h-3 mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs uppercase tracking-wider text-red-500 cursor-pointer"
                onClick={() => handleDeleteFolder(folder.id)}
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExpanded && (
          <div>
            {subfolders.map(subfolder => renderFolder(subfolder, depth + 1))}
            {folderProjects.map(project => (
              <div
                key={`proj-${project.id}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('project', JSON.stringify(project));
                }}
                style={{ marginLeft: `${(depth + 1) * 20}px` }}
                className="group flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/50 rounded-none border-l-2 border-l-transparent hover:border-l-red-600 transition-all cursor-pointer"
                onClick={() => onProjectClick?.(project)}
              >
                <Folder className="w-4 h-4 text-amber-500/50" />
                <span className="flex-1 text-sm text-zinc-300 hover:text-white uppercase tracking-tight">
                  {project.name}
                </span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                  Projeto
                </span>
              </div>
            ))}
            {folderVideos.map(video => (
              <div
                key={video.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('video', JSON.stringify(video));
                }}
                style={{ marginLeft: `${(depth + 1) * 20}px` }}
                className="group flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/50 rounded-none border-l-2 border-l-transparent hover:border-l-blue-600 transition-all cursor-pointer"
                onClick={() => onVideoClick(video)}
              >
                <File className="w-4 h-4 text-blue-400" />
                <span className="flex-1 text-sm text-zinc-400 hover:text-white uppercase tracking-tight">
                  {video.title}
                </span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                  {formatVideoDuration(video.duration)}
                </span>
              </div>
            ))}
            {folderFiles.map(file => renderFileItem(file, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-4 px-3">
        <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
          Estrutura de Pastas
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="glass-button border border-zinc-800 rounded-none h-7 text-[10px] uppercase tracking-wider"
          onClick={() => handleCreateFolder(currentFolderId)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Nova Pasta
        </Button>
      </div>

      {/* Pastas do nível atual */}
      {currentLevelFolders.map(folder => renderFolder(folder))}

      {/* Projetos do nível atual (sem pasta) */}
      {currentLevelProjects.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2 px-3">
            Projetos
          </div>
          {currentLevelProjects.map(project => (
            <div
              key={`proj-root-${project.id}`}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('project', JSON.stringify(project));
              }}
              className="group flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/50 rounded-none border-l-2 border-l-transparent hover:border-l-red-600 transition-all cursor-pointer"
              onClick={() => onProjectClick?.(project)}
            >
              <Folder className="w-4 h-4 text-amber-500/50" />
              <span className="flex-1 text-sm text-zinc-300 hover:text-white uppercase tracking-tight">
                {project.name}
              </span>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                Projeto
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Vídeos do nível atual (sem pasta) */}
      {currentLevelVideos.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2 px-3">
            Vídeos sem pasta
          </div>
          {currentLevelVideos.map(video => (
            <div
              key={video.id}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('video', JSON.stringify(video));
              }}
              className="group flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/50 rounded-none border-l-2 border-l-transparent hover:border-l-blue-600 transition-all cursor-pointer"
              onClick={() => onVideoClick(video)}
            >
              <File className="w-4 h-4 text-blue-400" />
              <span className="flex-1 text-sm text-zinc-400 hover:text-white uppercase tracking-tight">
                {video.title}
              </span>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                {formatVideoDuration(video.duration)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Arquivos do nível atual (sem pasta) */}
      {currentLevelFiles.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2 px-3">
            Arquivos sem pasta
          </div>
          {currentLevelFiles.map(file => renderFileItem(file))}
        </div>
      )}

      {currentLevelFolders.length === 0 && currentLevelVideos.length === 0 && currentLevelFiles.length === 0 && currentLevelProjects.length === 0 && (
        <div className="text-center py-8 text-zinc-600 text-xs uppercase tracking-wider">
          Nada para exibir neste nível
        </div>
      )}
    </div>
  );
}
