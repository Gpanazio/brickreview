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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function StoragePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await fetch("/api/storage/drive-files", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        toast.error("Erro ao carregar arquivos do Google Drive");
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
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

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="glass-button-primary border-none rounded-none px-6 h-10 font-black uppercase tracking-widest text-xs"
          >
            <Upload className="w-4 h-4 mr-3" />
            Fazer Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="glass-panel border-2 border-dashed border-zinc-800/50 hover:border-red-600/50 rounded-none p-12 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 bg-red-600/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="brick-title text-lg text-white mb-2">
                  Arraste arquivos aqui ou clique para selecionar
                </h3>
                <p className="brick-tech text-[10px] text-zinc-500 uppercase tracking-widest">
                  Todos os arquivos vão direto para o Google Drive
                </p>
              </div>
            </div>
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

          {/* Files List */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <HardDrive className="w-5 h-5 text-zinc-500" />
              <h3 className="brick-title text-md uppercase tracking-tighter text-white">
                Arquivos no Google Drive
              </h3>
              <span className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest">
                {files.length} arquivo{files.length !== 1 ? "s" : ""}
              </span>
            </div>

            {files.length === 0 ? (
              <div className="glass-panel border border-zinc-800/30 rounded-none p-12 text-center">
                <div className="w-16 h-16 bg-zinc-900/50 flex items-center justify-center mx-auto mb-4">
                  <File className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="brick-tech text-[10px] text-zinc-500 uppercase tracking-widest">
                  Nenhum arquivo encontrado
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file, index) => {
                  const FileIcon = getFileIcon(file.mimeType);
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="glass-panel border border-zinc-800/30 rounded-none p-4 hover:border-red-600/30 transition-all group"
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Footer */}
          <div className="bg-zinc-950/30 border border-zinc-800/30 rounded-none p-4">
            <p className="brick-tech text-[9px] text-zinc-600 uppercase tracking-widest text-center">
              Armazenamento direto no Google Drive • Sem passar pelo R2 • Backup automático em nuvem
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
