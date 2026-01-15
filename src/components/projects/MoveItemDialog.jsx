import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, ChevronRight, ChevronDown, Check, Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export function MoveItemDialog({
  isOpen,
  onClose,
  itemType,
  itemId,
  currentProjectId,
  onSuccess,
  token,
}) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isMoving, setIsMoving] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchFolders = useCallback(
    async (projId) => {
      try {
        const res = await fetch(`/api/folders/project/${projId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFolders(data || []);
      } catch (err) {
        console.error(err);
      }
    },
    [token]
  );

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setSelectedProject(currentProjectId);
      setSelectedFolderId(null);
    }
  }, [isOpen, currentProjectId, fetchProjects]);

  useEffect(() => {
    if (selectedProject) {
      fetchFolders(selectedProject);
    } else {
      setFolders([]);
    }
  }, [selectedProject, fetchFolders]);

  const handleMove = async () => {
    setIsMoving(true);
    try {
      const endpoint =
        itemType === "folder"
          ? `/api/folders/${itemId}/move`
          : itemType === "file"
            ? `/api/files/${itemId}/move`
            : `/api/videos/${itemId}/move`;

      const body = {
        project_id: selectedProject,
      };

      if (itemType === "folder") {
        body.new_parent_folder_id = selectedFolderId;
      } else {
        body.folder_id = selectedFolderId;
      }

      const res = await fetch(endpoint, {
        method: itemType === "folder" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao mover");
      }

      onSuccess();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsMoving(false);
    }
  };

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderFolderTree = (parentId = null, depth = 0) => {
    const currentLevel = folders.filter((f) => f.parent_folder_id === parentId);

    if (currentLevel.length === 0) return null;

    return (
      <div className="flex flex-col">
        {currentLevel.map((folder) => {
          if (itemType === "folder" && folder.id === itemId) return null;

          const isExpanded = expandedFolders.has(folder.id);
          const isSelected = selectedFolderId === folder.id;
          const hasChildren = folders.some((f) => f.parent_folder_id === folder.id);

          return (
            <div key={folder.id}>
              <div
                className={`flex items-center gap-2 py-2 px-2 cursor-pointer transition-colors ${isSelected ? "bg-red-600/20 text-red-500 font-bold" : "hover:bg-zinc-800 text-zinc-400"}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <button
                  onClick={(e) => toggleExpand(folder.id, e)}
                  className={`p-1 rounded-sm hover:bg-zinc-700 ${!hasChildren ? "invisible" : ""}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
                <Folder className="w-4 h-4" />
                <span className="text-xs truncate">{folder.name}</span>
                {isSelected && <Check className="w-3 h-3 ml-auto" />}
              </div>
              {isExpanded && renderFolderTree(folder.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md h-[500px] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b border-zinc-900">
          <DialogTitle className="brick-title text-lg uppercase tracking-tighter">
            Mover {itemType === "video" ? "Vídeo" : itemType === "folder" ? "Pasta" : "Arquivo"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {itemType !== "folder" && (
            <div className="w-1/3 border-r border-zinc-800 overflow-y-auto custom-scrollbar bg-zinc-900/20">
              <div className="p-2">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 px-2">
                  Projetos
                </div>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProject(p.id)}
                    className={`p-2 text-xs cursor-pointer rounded-sm mb-1 flex items-center gap-2 ${selectedProject === p.id ? "bg-zinc-800 text-white font-bold" : "text-zinc-400 hover:text-white"}`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className={`flex-1 overflow-y-auto custom-scrollbar ${itemType === "folder" ? "w-full" : ""}`}
          >
            <div className="p-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 px-2">
                Destino
              </div>

              <div
                className={`flex items-center gap-2 py-2 px-2 cursor-pointer transition-colors rounded-sm mb-1 ${selectedFolderId === null ? "bg-red-600/20 text-red-500 font-bold" : "hover:bg-zinc-800 text-zinc-400"}`}
                onClick={() => setSelectedFolderId(null)}
              >
                <div className="w-5" />
                <Building2 className="w-4 h-4" />
                <span className="text-xs">Raiz do Projeto</span>
                {selectedFolderId === null && <Check className="w-3 h-3 ml-auto" />}
              </div>

              {renderFolderTree()}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-zinc-900">
          <Button variant="ghost" onClick={onClose} className="rounded-none border border-zinc-800">
            Cancelar
          </Button>
          <Button
            onClick={handleMove}
            disabled={isMoving}
            className="bg-red-600 hover:bg-red-700 text-white rounded-none font-bold uppercase tracking-widest text-xs"
          >
            {isMoving ? "Movendo..." : "Mover Aqui"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
