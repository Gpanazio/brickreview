import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    HardDrive,
    File,
    FileVideo,
    FileImage,
    FileText,
    Download,
    Grid,
    List,
    Folder,
    FolderOpen,
    CornerUpLeft,
    X,
    ExternalLink,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileViewer } from "./FileViewer";

export function SharedStoragePage() {
    const { id } = useParams(); // This is the folder ID or file ID shared
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rootMetadata, setRootMetadata] = useState(null);

    // Navigation state
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);

    // Data state
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [viewMode, setViewMode] = useState("grid");
    const [previewFile, setPreviewFile] = useState(null);

    // Initial load
    useEffect(() => {
        fetchRootMetadata();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Fetch content when current folder changes
    useEffect(() => {
        if (currentFolder) {
            fetchFolderContents(currentFolder.id);
        }
    }, [currentFolder]);

    const fetchRootMetadata = async () => {
        setLoading(true);
        setError(null); // Clear any previous errors
        try {
            const response = await fetch(`/api/storage/public/metadata/${id}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Conteúdo não encontrado ou acesso negado");
            }
            const data = await response.json();
            setRootMetadata(data);

            // Initialize breadcrumbs and current folder
            setBreadcrumbs([{ id: data.id, name: data.name }]);
            setCurrentFolder({ id: data.id, name: data.name, mimeType: data.mimeType });

            // If it's a file, show preview immediately
            if (data.mimeType !== "application/vnd.google-apps.folder") {
                setPreviewFile(data);
                setLoading(false);
            }
        } catch (err) {
            console.error("Error fetching root metadata:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const fetchFolderContents = async (folderId) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/storage/public/files?folderId=${folderId}`);
            if (response.ok) {
                const data = await response.json();
                const allItems = data.files || [];

                // Separate folders and files
                const folderItems = allItems.filter(item => item.mimeType === "application/vnd.google-apps.folder");
                const fileItems = allItems.filter(item => item.mimeType !== "application/vnd.google-apps.folder");

                setFolders(folderItems);
                setFiles(fileItems);
            } else {
                const errorData = await response.json().catch(() => null);
                toast.error(errorData?.error || `${response.status}: ${response.statusText}` || "Erro ao carregar arquivos");
            }
        } catch (err) {
            console.error("Error fetching files:", err);
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
        setCurrentFolder(newBreadcrumbs[index]);
    };

    const handleNavigateUp = () => {
        if (breadcrumbs.length > 1) {
            handleBreadcrumbClick(breadcrumbs.length - 2);
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

    const handleFileClick = (file) => {
        setPreviewFile(file);
    };

    if (loading && !currentFolder) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#050505]">
                <div className="h-10 w-10 animate-spin border-4 border-red-600 border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-[#050505] text-white gap-4">
                <HardDrive className="w-12 h-12 text-red-600" />
                <h1 className="brick-title text-2xl">Acesso Indisponível</h1>
                <p className="text-zinc-500">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
                    Voltar ao Início
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#050505] text-white">
            {/* Header */}
            <header className="border-b border-zinc-800/20 glass-panel px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-10 h-10 flex items-center justify-center bg-red-600 text-white font-bold">
                        BR
                    </div>

                    <div className="flex-1 min-w-0">
                        <motion.h1
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="brick-title text-xl md:text-3xl tracking-tighter uppercase leading-none mb-2 truncate"
                        >
                            {rootMetadata?.name || "Shared Storage"}
                        </motion.h1>
                        <div className="flex items-center gap-2">
                            <span className="h-[1px] w-4 bg-red-600" />
                            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em] font-black">
                                Acesso Somente Leitura
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
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
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
                                    className={`cursor-pointer hover:text-white hover:underline transition-colors px-1 rounded ${index === breadcrumbs.length - 1 ? 'text-white font-medium' : ''}`}
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

                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <div className="h-8 w-8 animate-spin border-4 border-red-600 border-t-transparent" />
                        </div>
                    ) : (
                        <>
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
                                                        className="glass-panel border rounded-none p-4 flex items-center gap-3 cursor-pointer transition-all group hover:bg-zinc-900/50 border-zinc-800/30 hover:border-zinc-700"
                                                        onDoubleClick={() => handleFolderClick(folder)}
                                                    >
                                                        <Folder className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                                                        <span className="text-sm text-zinc-300 font-medium truncate group-hover:text-white">{folder.name}</span>
                                                    </motion.div>
                                                </ContextMenuTrigger>
                                                <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                                                    <ContextMenuItem onClick={() => handleFolderClick(folder)}>
                                                        <FolderOpen className="mr-2 h-4 w-4" /> Abrir
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
                                    <div className="glass-panel border border-zinc-800/30 rounded-none p-12 text-center">
                                        <div className="w-16 h-16 bg-zinc-900/50 flex items-center justify-center mx-auto mb-4">
                                            <File className="w-8 h-8 text-zinc-600" />
                                        </div>
                                        <p className="brick-tech text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                                            Esta pasta está vazia
                                        </p>
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
                                                            className="glass-panel border rounded-none p-4 transition-all group cursor-pointer border-zinc-800/30 hover:border-red-600/30"
                                                            onClick={() => handleFileClick(file)}
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
                                                                        onClick={(e) => { e.stopPropagation(); window.open(file.webContentLink || file.webViewLink, "_blank"); }}
                                                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </ContextMenuTrigger>
                                                    <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                                                        <ContextMenuItem onClick={() => handleFileClick(file)}>
                                                            <ExternalLink className="mr-2 h-4 w-4" /> Visualizar
                                                        </ContextMenuItem>
                                                        <ContextMenuItem onClick={() => window.open(file.webContentLink || file.webViewLink, "_blank")}>
                                                            <Download className="mr-2 h-4 w-4" /> Baixar
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
                                                            className="glass-panel border rounded-none p-4 transition-all group cursor-pointer border-zinc-800/30 hover:border-red-600/30"
                                                            onClick={() => handleFileClick(file)}
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
                                                            </div>
                                                        </motion.div>
                                                    </ContextMenuTrigger>
                                                    <ContextMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                                                        <ContextMenuItem onClick={() => handleFileClick(file)}>
                                                            <ExternalLink className="mr-2 h-4 w-4" /> Visualizar
                                                        </ContextMenuItem>
                                                        <ContextMenuItem onClick={() => window.open(file.webContentLink || file.webViewLink, "_blank")}>
                                                            <Download className="mr-2 h-4 w-4" /> Baixar
                                                        </ContextMenuItem>
                                                    </ContextMenuContent>
                                                </ContextMenu>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Preview Dialog */}
            <FileViewer
                file={previewFile}
                isOpen={!!previewFile}
                onClose={() => setPreviewFile(null)}
            />
        </div>
    );
}

