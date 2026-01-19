import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
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
import { Folder, FolderOpen, FolderPlus, MoreVertical, Plus, CornerUpLeft, Pencil, Share2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileViewer } from "./FileViewer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadProgressWidget } from "./UploadProgressWidget";

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

  // New state for Rename and Selection
  const [itemToRename, setItemToRename] = useState(null);
  const [newName, setNewName] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState(null);

  // Drop zone overlay state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounter = useRef(0);

  // Share link dialog state
  const [shareLink, setShareLink] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const fileInputRef = useRef(null);

  // Selection Box State
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const containerRef = useRef(null);
  const itemsRef = useRef(new Map());

  // Check if clicking on a file/folder item (draggable)
  const selectionOnDragStartRef = useRef(new Set());
  const cachedItemRectsRef = useRef(new Map());

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

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
    // If itemId is an array, it's a bulk move
    const itemsToMove = Array.isArray(itemId) ? itemId : [itemId];

    // Optimistic UI update (optional - complex due to SWR-like fetch)
    // For now we just rely on toast and refresh

    try {
      const promises = itemsToMove.map(id =>
        fetch("/api/storage/move", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileId: id,
            destinationFolderId,
          }),
        })
      );

      await Promise.all(promises);
      toast.success(`${itemsToMove.length} item(s) movido(s) com sucesso`);
      fetchFiles(currentFolder?.id);
      setSelectedIds(new Set()); // Clear selection after move
    } catch (error) {
      console.error("Error moving items:", error);
      toast.error("Erro ao mover itens");
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!itemToRename || !newName.trim()) return;

    try {
      const response = await fetch("/api/storage/rename", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileId: itemToRename.id,
          name: newName,
        }),
      });

      if (response.ok) {
        toast.success("Item renomeado com sucesso");
        setItemToRename(null);
        setNewName("");
        fetchFiles(currentFolder?.id);
      } else {
        toast.error("Erro ao renomear item");
      }
    } catch (error) {
      console.error("Error renaming item:", error);
      toast.error("Erro ao renomear item");
    }
  };

  const openRenameDialog = (item) => {
    setItemToRename(item);
    setNewName(item.name);
  };

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    const newSelected = new Set(e.metaKey || e.ctrlKey ? selectedIds : []);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      uploadFiles(selectedFiles);
    }
  };

  // Selection Box Logic
  const handleSelectionMouseDown = (e) => {
    // Ignore if clicking on generic interactive elements or right click
    if (e.target.closest('button') || e.target.closest('[role="menuitem"]') || e.button !== 0) return;

    // Check if clicking on a file/folder item (draggable)
    if (e.target.closest('[draggable="true"]')) return;

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const scrollLeft = containerRef.current.scrollLeft;

    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
    setIsSelecting(true);

    // Store initial selection state
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      selectionOnDragStartRef.current = new Set(selectedIds);
    } else {
      selectionOnDragStartRef.current = new Set();
      setSelectedIds(new Set());
    }

    // Cache item positions
    cachedItemRectsRef.current.clear();
    itemsRef.current.forEach((element, id) => {
      if (!element) return;
      const elRect = element.getBoundingClientRect();
      cachedItemRectsRef.current.set(id, {
        left: elRect.left - rect.left + scrollLeft,
        top: elRect.top - rect.top + scrollTop,
        width: elRect.width,
        height: elRect.height
      });
    });
  };

  const handleSelectionMouseMove = (e) => {
    if (!isSelecting || !selectionBox || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const scrollLeft = containerRef.current.scrollLeft;

    const currentX = e.clientX - rect.left + scrollLeft;
    const currentY = e.clientY - rect.top + scrollTop;

    setSelectionBox(prev => ({ ...prev, currentX, currentY }));

    // Calculate selection
    const boxLeft = Math.min(selectionBox.startX, currentX);
    const boxTop = Math.min(selectionBox.startY, currentY);
    const boxWidth = Math.abs(currentX - selectionBox.startX);
    const boxHeight = Math.abs(currentY - selectionBox.startY);

    // Start with base selection (from start of drag)
    const newSelected = new Set(selectionOnDragStartRef.current);

    // Add currently intersecting items
    cachedItemRectsRef.current.forEach((elRect, id) => {
      const isIntersecting = (
        boxLeft < elRect.left + elRect.width &&
        boxLeft + boxWidth > elRect.left &&
        boxTop < elRect.top + elRect.height &&
        boxTop + boxHeight > elRect.top
      );

      if (isIntersecting) {
        newSelected.add(id);
      }
    });

    setSelectedIds(newSelected);
  };

  const handleSelectionMouseUp = () => {
    setIsSelecting(false);
    setSelectionBox(null);
    cachedItemRectsRef.current.clear();
  };

  // Improved drag handlers for drop zone overlay
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDraggingFile(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounter.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles);
    }
  };

  // Share file/folder function
  const handleShare = async (item) => {
    try {
      const response = await fetch("/api/storage/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId: item.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareLink(data.shareLink);
        setShowShareDialog(true);
        toast.success("Link de compartilhamento gerado!");
      } else {
        toast.error("Erro ao gerar link de compartilhamento");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error("Erro ao gerar link de compartilhamento");
    }
  };

  const uploadFiles = async (filesToUpload) => {
    setUploading(true);

    const uploadPromises = filesToUpload.map((file) => {
      return new Promise((resolve, reject) => {
        const fileId = `${file.name}-${Date.now()}`;

        setUploadProgress((prev) => ({
          ...prev,
          [fileId]: { name: file.name, progress: 0, status: "uploading" },
        }));

        const formData = new FormData();
        formData.append("file", file);
        if (currentFolder?.id) {
          formData.append("parentId", currentFolder.id);
        }

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/storage/upload-to-drive");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setUploadProgress((prev) => ({
              ...prev,
              [fileId]: { ...prev[fileId], progress: percentComplete },
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress((prev) => ({
              ...prev,
              [fileId]: { ...prev[fileId], progress: 100, status: "success" },
            }));
            resolve(xhr.response);
          } else {
            let errorMsg = "Erro no upload";
            try {
              const res = JSON.parse(xhr.responseText);
              errorMsg = res.error || errorMsg;
            } catch (_e) { /* Ignore JSON parse errors */ }

            setUploadProgress((prev) => ({
              ...prev,
              [fileId]: { ...prev[fileId], status: "error", error: errorMsg },
            }));
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { ...prev[fileId], status: "error", error: "Falha na rede" },
          }));
          reject(new Error("Falha na rede"));
        };

        xhr.send(formData);
      });
    });

    try {
      await Promise.allSettled(uploadPromises);
      toast.success("Processamento de uploads finalizado");
      fetchFiles(currentFolder?.id);
    } catch (error) {
      console.error("Erro nos uploads:", error);
    } finally {
      setUploading(false);
      // Wait a bit before clearing completed uploads from list if you want, 
      // but usually we rely on the widget's close button or keep them there for a while
      // The user can close the widget manually.
    }
  };

  const handleDelete = async (fileId, fileName) => {
    // Check if it's a bulk delete
    const isBulk = Array.isArray(fileId);
    const count = isBulk ? fileId.length : 1;
    const displayName = isBulk ? `${count} itens` : `"${fileName}"`;

    setConfirmDialog({
      isOpen: true,
      title: isBulk ? "Excluir Itens" : "Excluir Arquivo",
      message: `Tem certeza que deseja excluir ${displayName}?`,
      onConfirm: async () => {
        try {
          // If array, delete all
          if (isBulk) {
            const promises = fileId.map(id =>
              fetch(`/api/storage/drive-files/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              })
            );
            await Promise.all(promises);
            toast.success(`${count} itens excluídos com sucesso!`);
            setSelectedIds(new Set());
          } else {
            // Single delete
            const response = await fetch(`/api/storage/drive-files/${fileId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              toast.success("Item excluído com sucesso!");
            } else {
              toast.error("Erro ao excluir item");
            }
          }
          fetchFiles(currentFolder?.id);
        } catch (error) {
          console.error("Delete error:", error);
          toast.error("Erro ao excluir");
        }
      },
    });
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
              className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50 cursor-pointer"
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
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative select-none"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleSelectionMouseDown}
        onMouseMove={handleSelectionMouseMove}
        onMouseUp={handleSelectionMouseUp}
        onMouseLeave={handleSelectionMouseUp}
      >
        {/* Selection Box */}
        {selectionBox && (
          <div
            className="absolute border border-red-500 bg-red-500/10 pointer-events-none z-50"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
            }}
          />
        )}

        {/* Floating Bulk Action Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0a0a0a] border border-zinc-800 p-2 shadow-2xl rounded-full"
            >
              <div className="px-4 border-r border-zinc-800 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">
                  {selectedIds.size} Selecionado{selectedIds.size > 1 ? 's' : ''}
                </span>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(Array.from(selectedIds), "Itens selecionados")}
                className="hover:bg-red-500/10 hover:text-red-500 h-8 rounded-full px-4 text-[10px] font-black uppercase tracking-widest text-zinc-400"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Excluir
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="hover:bg-zinc-800 h-8 rounded-full px-3 text-zinc-500 hover:text-zinc-300"
              >
                <span className="sr-only">Cancelar</span>
                ✕
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Drop Zone Overlay */}
        <AnimatePresence>
          {isDraggingFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm border-4 border-dashed border-red-600 flex items-center justify-center pointer-events-none"
            >
              <div className="text-center">
                <Upload className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <p className="brick-title text-2xl text-white mb-2">Solte os arquivos aqui</p>
                <p className="brick-tech text-xs text-zinc-400 uppercase tracking-widest">
                  Upload para {currentFolder?.name || "Meu Drive"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ContextMenu>
          <ContextMenuTrigger className="min-h-full block">
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
                  <div
                    key={crumb.id || 'root'}
                    className="flex items-center"
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (crumb.id !== currentFolder?.id) {
                        setDragOverBreadcrumb(index);
                      }
                    }}
                    onDragLeave={() => setDragOverBreadcrumb(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverBreadcrumb(null);
                      if (crumb.id === currentFolder?.id) return;

                      const data = e.dataTransfer.getData("application/x-drive-items"); // Use plural
                      if (data) {
                        try {
                          const items = JSON.parse(data);
                          if (Array.isArray(items)) {
                            // Correctly handle multiple items move
                            const idsToMove = items
                              .filter(item => item.id !== crumb.id)
                              .map(item => item.id);

                            if (idsToMove.length > 0) {
                              handleMoveItem(idsToMove, crumb.id);
                            }
                          }
                        } catch (err) { console.error("Drop error", err); }
                      }
                    }}
                  >
                    <span
                      className={`cursor-pointer hover:text-white hover:underline transition-colors px-1 rounded ${index === breadcrumbs.length - 1 ? 'text-white font-medium' : ''} ${dragOverBreadcrumb === index ? 'bg-red-600/20 text-red-500' : ''}`}
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

              {/* Upload Progress - Moved to Widget */}

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
                            ref={el => {
                              if (el) itemsRef.current.set(folder.id, el);
                              else itemsRef.current.delete(folder.id);
                            }}
                            className={`glass-panel border rounded-none p-4 flex items-center gap-3 cursor-pointer transition-all group ${selectedIds.has(folder.id) ? 'bg-white/10 border-red-600' : 'hover:bg-zinc-900/50 border-zinc-800/30 hover:border-zinc-700'
                              } ${dragOverFolder === folder.id ? 'border-red-600 bg-red-900/10' : ''}`}
                            onClick={(e) => toggleSelection(e, folder.id)}
                            onDoubleClick={() => handleFolderClick(folder)}
                            draggable
                            onDragStart={(e) => {
                              // Check if dragging a selected item
                              const itemsToDrag = selectedIds.has(folder.id)
                                ? Array.from(selectedIds).map(id => ({ id, type: 'folder' })) // Simplify type assumption or lookup
                                : [{ id: folder.id, type: 'folder' }];

                              e.dataTransfer.setData("application/x-drive-items", JSON.stringify(itemsToDrag));
                              // Also set legacy for compatibility if needed, using first item
                              e.dataTransfer.setData("application/x-drive-item", JSON.stringify(itemsToDrag[0]));
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
                              const dataItems = e.dataTransfer.getData("application/x-drive-items");
                              if (dataItems) {
                                try {
                                  const items = JSON.parse(dataItems);
                                  const idsToMove = items
                                    .filter(item => item.id !== folder.id)
                                    .map(item => item.id);

                                  if (idsToMove.length > 0) {
                                    handleMoveItem(idsToMove, folder.id);
                                  }
                                } catch (err) { console.error(err); }
                              }
                            }}
                          >
                            <Folder className={`w-5 h-5 text-zinc-500 group-hover:text-white transition-colors ${dragOverFolder === folder.id ? 'text-red-500' : ''}`} />
                            <span className="text-sm text-zinc-300 font-medium truncate group-hover:text-white flex-1">{folder.name}</span>

                            {/* Mobile/Desktop Action Menu */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-sm"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300" align="end">
                                  <DropdownMenuItem onClick={() => handleFolderClick(folder)}>
                                    <FolderOpen className="mr-2 h-4 w-4" /> Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleShare(folder)}>
                                    <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openRenameDialog(folder)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Renomear
                                  </DropdownMenuItem>
                                  <ContextMenuSeparator className="bg-zinc-800" />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-500"
                                    onClick={() => handleDelete(folder.id, folder.name)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </motion.div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                          <ContextMenuItem onClick={() => handleFolderClick(folder)}>
                            <FolderOpen className="mr-2 h-4 w-4" /> Abrir
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleShare(folder)}>
                            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => openRenameDialog(folder)}>
                            <Pencil className="mr-2 h-4 w-4" /> Renomear
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
                              ref={el => {
                                if (el) itemsRef.current.set(file.id, el);
                                else itemsRef.current.delete(file.id);
                              }}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`glass-panel border rounded-none p-4 transition-all group cursor-pointer ${selectedIds.has(file.id) ? 'bg-white/10 border-red-600' : 'border-zinc-800/30 hover:border-red-600/30'
                                }`}
                              onClick={(e) => toggleSelection(e, file.id)}
                              onDoubleClick={() => setPreviewFile(file)}
                              draggable
                              onDragStart={(e) => {
                                // Check if dragging a selected item
                                const itemsToDrag = selectedIds.has(file.id)
                                  ? Array.from(selectedIds).map(id => ({ id, type: 'file' })) // Simplify type assumption
                                  : [{ id: file.id, type: 'file' }];

                                e.dataTransfer.setData("application/x-drive-items", JSON.stringify(itemsToDrag));
                                e.dataTransfer.setData("application/x-drive-item", JSON.stringify(itemsToDrag[0]));
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
                                <div className="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); handleShare(file); }}
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); window.open(file.webViewLink, "_blank"); }}
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.name); }}
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
                            <ContextMenuItem onClick={() => handleShare(file)}>
                              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => openRenameDialog(file)}>
                              <Pencil className="mr-2 h-4 w-4" /> Renomear
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
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
                    {files.map((file, index) => {
                      const FileIcon = getFileIcon(file.mimeType);
                      return (
                        <ContextMenu key={file.id}>
                          <ContextMenuTrigger>
                            <motion.div
                              layout
                              ref={el => {
                                if (el) itemsRef.current.set(file.id, el);
                                else itemsRef.current.delete(file.id);
                              }}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className={`glass-panel border rounded-none p-4 transition-all group cursor-pointer ${selectedIds.has(file.id) ? 'bg-white/10 border-red-600' : 'border-zinc-800/30 hover:border-red-600/30'
                                }`}
                              onClick={(e) => toggleSelection(e, file.id)}
                              onDoubleClick={() => setPreviewFile(file)}
                              draggable
                              onDragStart={(e) => {
                                // Check if dragging a selected item
                                const itemsToDrag = selectedIds.has(file.id)
                                  ? Array.from(selectedIds).map(id => ({ id, type: 'file' })) // Simplify type assumption
                                  : [{ id: file.id, type: 'file' }];

                                e.dataTransfer.setData("application/x-drive-items", JSON.stringify(itemsToDrag));
                                e.dataTransfer.setData("application/x-drive-item", JSON.stringify(itemsToDrag[0]));
                              }}
                            >
                              <div className="flex flex-col gap-3">
                                <div
                                  className="w-full aspect-square bg-zinc-900/50 flex items-center justify-center relative overflow-hidden"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewFile(file);
                                  }}
                                >
                                  {file.thumbnailLink ? (
                                    <img
                                      src={file.thumbnailLink}
                                      alt={file.name}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                  ) : (
                                    <FileIcon className="w-12 h-12 text-zinc-500" />
                                  )}

                                  {/* Hover Overlay with Download */}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-white hover:text-red-500 hover:bg-black/50 rounded-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(file.webViewLink, "_blank");
                                      }}
                                    >
                                      <Download className="w-6 h-6" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="brick-title text-xs text-white truncate mb-2">
                                    {file.name}
                                  </h4>
                                  <span className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest block">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                                <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-white bg-black/50 hover:bg-black/80 rounded-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300" align="end">
                                      <DropdownMenuItem onClick={() => window.open(file.webViewLink, "_blank")}>
                                        <Download className="mr-2 h-4 w-4" /> Baixar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleShare(file)}>
                                        <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openRenameDialog(file)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Renomear
                                      </DropdownMenuItem>
                                      <ContextMenuSeparator className="bg-zinc-800" />
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-500"
                                        onClick={() => handleDelete(file.id, file.name)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <div className="flex items-center gap-2 opacity-100 md:opacity-40 md:group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-800/30">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); handleShare(file); }}
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 flex-1"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); window.open(file.webViewLink, "_blank"); }}
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
                              <Download className="mr-2 h-4 w-4" /> Baixar
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleShare(file)}>
                              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => openRenameDialog(file)}>
                              <Pencil className="mr-2 h-4 w-4" /> Renomear
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
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300">
            <ContextMenuItem
              className="focus:bg-red-600 focus:text-white cursor-pointer"
              onClick={() => setIsCreateFolderOpen(true)}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Nova Pasta
            </ContextMenuItem>
            <ContextMenuItem
              className="focus:bg-red-600 focus:text-white cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Fazer Upload
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Upload Progress Widget */}
      <UploadProgressWidget
        uploads={uploadProgress}
        onClose={() => setUploadProgress({})}
      />

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
        title={currentFolder ? "Nova Subpasta" : "Nova Pasta"}
      />

      {/* Rename Dialog */}
      <Dialog open={!!itemToRename} onOpenChange={(open) => !open && setItemToRename(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 rounded-none text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="brick-title text-xl tracking-tighter uppercase">
              Renomear
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                Novo Nome
              </Label>
              <Input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="glass-input border-none rounded-none h-12"
                placeholder="Nome do item"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setItemToRename(null)}
                className="glass-button border border-zinc-800 rounded-none h-10 w-full md:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="glass-button-primary border-none rounded-none h-10 w-full md:w-auto font-black uppercase tracking-widest"
              >
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share Link Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800 rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="brick-title text-xl uppercase tracking-tighter text-white">
              Link de Compartilhamento
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
              Link público criado! Copie o link abaixo:
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareLink}
                className="bg-zinc-900 border-zinc-800 rounded-none text-xs text-zinc-300 focus:ring-red-600 h-10"
                onClick={(e) => e.target.select()}
              />
              <Button
                variant="ghost"
                className="bg-red-600 hover:bg-red-700 text-white rounded-none h-10 px-4 text-[10px] font-black uppercase tracking-widest"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  toast.success("Link copiado!");
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FileViewer
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        token={token}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => confirmDialog.onConfirm?.()}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
      />
    </div >
  );
}

