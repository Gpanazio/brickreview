import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  HardDrive,
  Upload,
  File,
  FileVideo,
  FileImage,
  FileText,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Grid,
  List,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { CreateFolderDialog } from "../projects/CreateFolderDialog"; // Reusing existing dialog
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Folder, FolderOpen, MoreVertical, Plus, CornerUpLeft } from "lucide-react";

export function StoragePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null); // null = root
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: "Meu Drive" }]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [viewMode, setViewMode] = useState("grid");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles(currentFolder?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder]);

  const fetchFiles = async (folderId = null) => {
    setLoading(true);
    try {
      const url = folderId
        ? `/api/storage/drive-files?folderId=${folderId}`
        : "/api/storage/drive-files";

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const allItems = data.files || [];

        // Separate folders and files
        const folderItems = allItems.filter(item => item.mimeType === "application/vnd.google-apps.folder");
        const fileItems = allItems.filter(item => item.mimeType !== "application/vnd.google-apps.folder");

        setFolders(folderItems);
        setFiles(fileItems);
      } else {
        toast.error("Erro ao carregar arquivos");
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setCurrentFolder(folder);
  };

  const handleBreadcrumbClick = (index) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolder(newBreadcrumbs[index].id ? newBreadcrumbs[index] : null);
  };

  const handleNavigateUp = () => {
    if (breadcrumbs.length > 1) {
      handleBreadcrumbClick(breadcrumbs.length - 2);
    }
  };

  const handleCreateFolder = async (name) => {
    try {
      const response = await fetch("/api/storage/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          parentId: currentFolder?.id,
        }),
      });

      if (response.ok) {
        toast.success("Pasta criada com sucesso");
        fetchFiles(currentFolder?.id);
        setIsCreateFolderOpen(false);
      } else {
        toast.error("Erro ao criar pasta");
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Erro ao criar pasta");
    }
  };

  const handleMoveItem = async (itemId, destinationFolderId) => {
    try {
      const response = await fetch("/api/storage/move", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileId: itemId,
          destinationFolderId,
        }),
      });

      if (response.ok) {
        toast.success("Item movido com sucesso");
        fetchFiles(currentFolder?.id);
      } else {
        toast.error("Erro ao mover item");
      }
    } catch (error) {
      console.error("Error moving item:", error);
      toast.error("Erro ao mover item");
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      uploadFiles(selectedFiles);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const uploadFiles = async (filesToUpload) => {
    setUploading(true);
    const newProgress = {};

    for (const file of filesToUpload) {
      const fileId = `${file.name}-${Date.now()}`;
      newProgress[fileId] = { name: file.name, progress: 0, status: "uploading" };
      setUploadProgress({ ...newProgress });

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolder?.id) {
          formData.append("parentId", currentFolder.id);
        }

        const response = await fetch("/api/storage/upload-to-drive", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          newProgress[fileId] = { name: file.name, progress: 100, status: "success" };
          setUploadProgress({ ...newProgress });
          toast.success(`${file.name} enviado com sucesso!`);
        } else {
          const error = await response.json();
          newProgress[fileId] = {
            name: file.name,
            progress: 0,
            status: "error",
            error: error.error || "Erro no upload",
          };
          setUploadProgress({ ...newProgress });
          toast.error(`Erro ao enviar ${file.name}`);
        }
      } catch (error) {
        console.error("Upload error:", error);
        newProgress[fileId] = {
          name: file.name,
          progress: 0,
          status: "error",
          error: error.message,
        };
        setUploadProgress({ ...newProgress });
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    setUploading(false);
    fetchFiles();

    // Limpar progresso após 3 segundos
    setTimeout(() => {
      setUploadProgress({});
    }, 3000);
  };

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Tem certeza que deseja excluir "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/storage/drive-files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Arquivo excluído com sucesso!");
        fetchFiles();
      } else {
        toast.error("Erro ao excluir arquivo");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir arquivo");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return File;
    if (mimeType.startsWith("video/")) return FileVideo;
    if (mimeType.startsWith("image/")) return FileImage;
    if (mimeType.startsWith("text/")) return FileText;
    return File;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="h-10 w-10 animate-spin border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <header className="border-b border-zinc-800/20 glass-panel px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

        <div className="flex items-center gap-6 relative z-10">
          <motion.div
            whileHover={{ x: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </motion.div>

          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="brick-title text-2xl md:text-4xl tracking-tighter uppercase leading-none mb-2"
            >
              Storage
            </motion.h1>
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-4 bg-red-600" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em] font-black">
                Google Drive • Upload Direto
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setViewMode("list")}
              className={`w-10 h-10 p-0 border rounded-none transition-colors ${viewMode === "list"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
            >
              <List className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => setViewMode("grid")}
              className={`w-10 h-10 p-0 border rounded-none transition-colors ${viewMode === "grid"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
            >
              <Grid className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="glass-button-primary border-none rounded-none px-6 h-10 font-black uppercase tracking-widest text-xs ml-2"
            >
              <Upload className="w-4 h-4 mr-3" />
              Fazer Upload
            </Button>
            <Button
              onClick={() => setIsCreateFolderOpen(true)}
              className="glass-button border border-zinc-800 rounded-none px-4 h-10 font-black uppercase tracking-widest text-xs"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            {breadcrumbs.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNavigateUp}
                className="h-8 w-8 mr-2 text-zinc-400 hover:text-white"
              >
                <CornerUpLeft className="w-4 h-4" />
              </Button>
            )}
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || 'root'} className="flex items-center">
                <span
                  className={`cursor-pointer hover:text-white hover:underline ${index === breadcrumbs.length - 1 ? 'text-white font-medium' : ''}`}
                  onClick={() => handleBreadcrumbClick(index)}
                >
                  {crumb.name}
                </span>
                {index < breadcrumbs.length - 1 && (
                  <span className="mx-2 text-zinc-600">/</span>
                )}
              </div>
            ))}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="glass-panel border border-zinc-800/30 rounded-none p-6">
              <h3 className="brick-title text-md uppercase tracking-tighter text-white mb-4">
                Uploads em Progresso
              </h3>
              <div className="space-y-3">
                {Object.entries(uploadProgress).map(([id, file]) => (
                  <div key={id} className="flex items-center gap-3">
                    {file.status === "uploading" && (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    )}
                    {file.status === "success" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {file.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-zinc-400 flex-1">{file.name}</span>
                    {file.error && (
                      <span className="text-xs text-red-500">{file.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Folders Section */}
          {folders.length > 0 && (
            <div className="space-y-4">
              <h3 className="brick-title text-xs text-zinc-500 uppercase tracking-widest font-bold">
                Pastas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {folders.map((folder) => (
                  <ContextMenu key={folder.id}>
                    <ContextMenuTrigger>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`glass-panel border rounded-none p-4 flex items-center gap-3 hover:bg-zinc-900/50 cursor-pointer transition-all group ${dragOverFolder === folder.id ? 'border-red-600 bg-red-900/10' : 'border-zinc-800/30 hover:border-zinc-700'}`}
                        onClick={() => handleFolderClick(folder)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/x-drive-item", JSON.stringify({ id: folder.id, type: 'folder' }));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverFolder(folder.id);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setDragOverFolder(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverFolder(null);
                          const data = e.dataTransfer.getData("application/x-drive-item");
                          if (data) {
                            const item = JSON.parse(data);
                            if (item.id !== folder.id) { // Prevent dropping folder into itself
                              handleMoveItem(item.id, folder.id);
                            }
                          }
                        }}
                      >
                        <Folder className={`w-5 h-5 text-zinc-500 group-hover:text-white transition-colors ${dragOverFolder === folder.id ? 'text-red-500' : ''}`} />
                        <span className="text-sm text-zinc-300 font-medium truncate group-hover:text-white">{folder.name}</span>
                      </motion.div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                      <ContextMenuItem onClick={() => handleFolderClick(folder)}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Abrir
                      </ContextMenuItem>
                      <ContextMenuSeparator className="bg-zinc-800" />
                      <ContextMenuItem
                        className="text-red-600 focus:text-red-500"
                        onClick={() => handleDelete(folder.id, folder.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}

          {/* Files List */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <HardDrive className="w-5 h-5 text-zinc-500" />
              <h3 className="brick-title text-md uppercase tracking-tighter text-white">
                Arquivos
              </h3>
              <span className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest">
                {files.length} arquivo{files.length !== 1 ? "s" : ""}
              </span>
            </div>

            {files.length === 0 && folders.length === 0 ? (
              <div className="glass-panel border border-zinc-800/30 rounded-none p-12 text-center"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setIsCreateFolderOpen(true);
                }}
              >
                <div className="w-16 h-16 bg-zinc-900/50 flex items-center justify-center mx-auto mb-4">
                  <File className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="brick-tech text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                  Esta pasta está vazia
                </p>
                <Button variant="link" onClick={() => setIsCreateFolderOpen(true)} className="text-red-500 p-0 h-auto text-xs">
                  Criar uma pasta nova
                </Button>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-2">
                {files.map((file, index) => {
                  const FileIcon = getFileIcon(file.mimeType);
                  return (
                    <ContextMenu key={file.id}>
                      <ContextMenuTrigger>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="glass-panel border border-zinc-800/30 rounded-none p-4 hover:border-red-600/30 transition-all group"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-drive-item", JSON.stringify({ id: file.id, type: 'file' }));
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-zinc-900/50 flex items-center justify-center flex-shrink-0">
                              <FileIcon className="w-5 h-5 text-zinc-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="brick-title text-sm text-white truncate">
                                {file.name}
                              </h4>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest">
                                  {formatFileSize(file.size)}
                                </span>
                                <span className="brick-tech text-[9px] text-zinc-600 uppercase tracking-widest">
                                  {new Date(file.createdTime).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(file.webViewLink, "_blank")}
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(file.id, file.name)}
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                        <ContextMenuItem onClick={() => window.open(file.webViewLink, "_blank")}>
                          <Download className="mr-2 h-4 w-4" /> Abrir / Baixar
                        </ContextMenuItem>
                        <ContextMenuSeparator className="bg-zinc-800" />
                        <ContextMenuItem
                          className="text-red-600 focus:text-red-500"
                          onClick={() => handleDelete(file.id, file.name)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {files.map((file, index) => {
                  const FileIcon = getFileIcon(file.mimeType);
                  return (
                    <ContextMenu key={file.id}>
                      <ContextMenuTrigger>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="glass-panel border border-zinc-800/30 rounded-none p-4 hover:border-red-600/30 transition-all group"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-drive-item", JSON.stringify({ id: file.id, type: 'file' }));
                          }}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="w-full aspect-square bg-zinc-900/50 flex items-center justify-center">
                              {file.thumbnailLink ? (
                                <img
                                  src={file.thumbnailLink}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileIcon className="w-12 h-12 text-zinc-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="brick-title text-xs text-white truncate mb-2">
                                {file.name}
                              </h4>
                              <span className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest block">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-800/30">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(file.webViewLink, "_blank")}
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 flex-1"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(file.id, file.name)}
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 flex-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                        <ContextMenuItem onClick={() => window.open(file.webViewLink, "_blank")}>
                          <Download className="mr-2 h-4 w-4" /> Abrir / Baixar
                        </ContextMenuItem>
                        <ContextMenuSeparator className="bg-zinc-800" />
                        <ContextMenuItem
                          className="text-red-600 focus:text-red-500"
                          onClick={() => handleDelete(file.id, file.name)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Create Folder Dialog */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
        title={currentFolder ? "Nova Subpasta" : "Nova Pasta"}
      />
    </div>
  );
}
