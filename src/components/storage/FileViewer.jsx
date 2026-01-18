import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, File } from "lucide-react";

import { VideoLoadingState } from "@/components/ui/VideoLoadingState";

export function FileViewer({ file, isOpen, onClose, token }) {
    const [imageHasError, setImageHasError] = useState(false);
    const [videoHasError, setVideoHasError] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);

    // Reset error states when file changes or dialog closes
    useEffect(() => {
        if (isOpen && file) {
            setImageHasError(false);
            setVideoHasError(false);
        }
    }, [file?.id, isOpen]);

    if (!file) return null;

    // Safe URL opener - prevents XSS via javascript: URLs
    const openSafeUrl = (url) => {
        if (!url) {
            console.error('No URL provided');
            return;
        }

        // Only allow http and https protocols
        if (url.trim().startsWith('https://') || url.trim().startsWith('http://')) {
            window.open(url.trim(), '_blank', 'noopener,noreferrer');
        } else {
            console.error('Blocked attempt to open unsafe URL:', url);
        }
    };

    // Reusable error display component (reserved for future use)
    // eslint-disable-next-line no-unused-vars
    const renderErrorState = (errorMessage) => (
        <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-zinc-900 flex items-center justify-center rounded-lg">
                <File className="w-10 h-10 text-zinc-700" />
            </div>
            <p className="text-zinc-500 text-sm">{errorMessage}</p>
            {file.webViewLink && (
                <Button
                    onClick={() => openSafeUrl(file.webViewLink)}
                    className="glass-button-primary border-none rounded-none h-10 px-6"
                >
                    Abrir no Google Drive
                </Button>
            )}
        </div>
    );

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    };

    // Safely get mimeType (handle both mimeType and mime_type)
    const mimeType = file.mimeType || file.mime_type || "";

    const isImage = mimeType.startsWith("image/");
    const isVideo = mimeType.startsWith("video/");
    const isAudio = mimeType.startsWith("audio/");
    const isPdf = mimeType === "application/pdf";
    const isIframePreview = isPdf ||
        mimeType.includes("text/") ||
        mimeType.includes("application/vnd.google-apps") ||
        mimeType.includes("application/msword") ||
        mimeType.includes("application/vnd.openxmlformats-officedocument");

    const getProxyUrl = (file) => {
        if (!file || !token) return "";
        return `/api/storage/proxy/${file.id}?token=${token}`;
    };

    const renderContent = () => {
        const proxyUrl = getProxyUrl(file);

        if (isImage) {
            return (
                <img
                    src={proxyUrl}
                    alt={file.name}
                    className="max-h-full max-w-full object-contain"
                    onError={() => {
                        console.error("Error loading image from proxy:", proxyUrl);
                        setImageHasError(true);
                    }}
                />
            );
        }

        if (isVideo) {
            return (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                    {isVideoLoading && <VideoLoadingState message="Carregando vídeo..." />}
                    <video
                        src={proxyUrl}
                        controls
                        className="max-h-full max-w-full"
                        onLoadStart={() => setIsVideoLoading(true)}
                        onWaiting={() => setIsVideoLoading(true)}
                        onCanPlay={() => setIsVideoLoading(false)}
                        onLoadedData={() => setIsVideoLoading(false)}
                        onError={() => {
                            console.error("Error loading video from proxy:", proxyUrl);
                            setVideoHasError(true);
                            setIsVideoLoading(false);
                        }}
                    >
                        Seu navegador não suporta a reprodução deste vídeo.
                    </video>
                </div>
            );
        }

        if (isAudio) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 p-10">
                    <div className="w-24 h-24 mb-6 rounded-full bg-zinc-800 flex items-center justify-center animate-pulse">
                        <File className="w-10 h-10 text-red-500" />
                    </div>
                    <audio
                        src={proxyUrl}
                        controls
                        autoPlay
                        className="w-full max-w-md"
                    >
                        Seu navegador não suporta a reprodução deste áudio.
                    </audio>
                </div>
            );
        }

        // For PDFs and documents, Google Drive blocks iframe embedding due to their CSP
        // Instead, provide a download/open option
        if (isIframePreview) {
            const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;

            return (
                <div className="w-full h-full flex flex-col">
                    <iframe
                        src={previewUrl}
                        className="w-full h-full border-none bg-white"
                        allow="autoplay"
                        title={file.name}
                    />
                </div>
            );
        }

        // Default fallback
        return (
            <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-zinc-900 flex items-center justify-center rounded-lg">
                    <File className="w-10 h-10 text-zinc-700" />
                </div>
                <p className="text-zinc-500 text-xs italic">
                    Visualização indisponível. Por favor, baixe o arquivo.
                </p>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-zinc-950 border-zinc-800 rounded-lg max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 flex flex-col overflow-hidden outline-none">
                <DialogHeader className="p-4 border-b border-zinc-800/50 flex flex-row items-center justify-between bg-[#0a0a0a] shrink-0">
                    <div className="flex-1 min-w-0 mr-4">
                        <DialogTitle className="brick-title text-lg md:text-xl uppercase tracking-tighter text-white truncate">
                            {file.name}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Visualizador de arquivo: {file.name}, tamanho {formatFileSize(file.size)}, tipo {mimeType || "desconhecido"}
                        </DialogDescription>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-2 py-0.5 rounded">
                                {formatFileSize(file.size)}
                            </span>
                            <span className="brick-tech text-[9px] text-zinc-600 uppercase tracking-widest truncate max-w-[200px]">
                                {mimeType || "Tipo desconhecido"}
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                {/* Viewer Area */}
                <div className="flex-1 bg-black relative flex items-center justify-center overflow-auto min-h-[300px] min-w-[300px]">
                    {renderContent()}
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#0a0a0a] border-t border-zinc-800/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black hidden md:block">
                            BRICK CLOUD VIEWER
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {file.webViewLink && (
                            <Button
                                onClick={() => openSafeUrl(file.webViewLink)}
                                variant="outline"
                                className="border-zinc-800 bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-none h-9 px-4 text-[10px] font-black uppercase tracking-widest"
                            >
                                Abrir no Drive
                            </Button>
                        )}
                        <Button
                            onClick={() => openSafeUrl(file.webContentLink || file.webViewLink)}
                            className="glass-button-primary border-none rounded-none h-9 px-6 text-[10px] font-black uppercase tracking-widest"
                        >
                            <Download className="w-3 h-3 mr-2" />
                            Baixar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
