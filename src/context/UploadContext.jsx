import { createContext, useContext, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";

const UploadContext = createContext(null);

export function UploadProvider({ children }) {
    const [uploadQueue, setUploadQueue] = useState([]);
    const { token } = useAuth();
    // Ref to track if uploads are active for beforeUnload warning if needed
    const activeUploadsCount = useRef(0);
    const refreshCallbacksRef = useRef(new Set());

    const addToQueue = useCallback((items) => {
        setUploadQueue((prev) => [...prev, ...items]);
        activeUploadsCount.current += items.length;
    }, []);

    const updateUploadStatus = useCallback((id, status, error = null) => {
        setUploadQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status, error } : item))
        );
        if (status === "success" || status === "error") {
            activeUploadsCount.current = Math.max(0, activeUploadsCount.current - 1);
            // Remove from queue after delay if success
            if (status === "success") {
                // Trigger all refresh callbacks when upload succeeds
                refreshCallbacksRef.current.forEach(callback => {
                    try {
                        callback();
                    } catch (error) {
                        console.error("Error in upload refresh callback:", error);
                    }
                });

                setTimeout(() => {
                    setUploadQueue((prev) => prev.filter((u) => u.id !== id));
                }, 1500);
            }
        }
    }, []);

    const uploadFiles = useCallback(async (files, projectId, folderId = null) => {
        const newUploads = Array.from(files).map((file) => ({
            id: Math.random().toString(36),
            name: file.name,
            status: "uploading",
            isVideo: file.type.startsWith("video/"),
            projectId: projectId, // store context
            folderId: folderId
        }));

        addToQueue(newUploads);

        // Process uploads
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uploadItem = newUploads[i];
            const isVideo = file.type.startsWith("video/");

            const formData = new FormData();
            if (isVideo) {
                formData.append("video", file);
                formData.append("project_id", projectId);
                formData.append("title", file.name.split(".")[0]);
                if (folderId) formData.append("folder_id", folderId);
            } else {
                formData.append("file", file);
                formData.append("project_id", projectId);
                formData.append("name", file.name);
                if (folderId) formData.append("folder_id", folderId);
            }

            try {
                const endpoint = isVideo ? "/api/videos/upload" : "/api/files/upload";
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (response.ok) {
                    toast.success(`${file.name} ENVIADO`, {
                        description: isVideo ? "Processamento iniciado" : "Arquivo salvo",
                    });
                    updateUploadStatus(uploadItem.id, "success");
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMsg = errorData.error || "Erro desconhecido";
                    toast.error("FALHA NO UPLOAD", { description: errorMsg });
                    updateUploadStatus(uploadItem.id, "error", errorMsg);
                }
            } catch (error) {
                console.error("Upload error:", error);
                toast.error("ERRO DE CONEXÃO", { description: `Falha ao enviar ${file.name}` });
                updateUploadStatus(uploadItem.id, "error", error.message);
            }
        }
    }, [token, addToQueue, updateUploadStatus]);

    const registerRefreshCallback = useCallback((callback) => {
        refreshCallbacksRef.current.add(callback);
        // Return unregister function
        return () => {
            refreshCallbacksRef.current.delete(callback);
        };
    }, []);

    const value = {
        uploadQueue,
        uploadFiles,
        isUploading: uploadQueue.some(u => u.status === "uploading"),
        registerRefreshCallback
    };

    return (
        <UploadContext.Provider value={value}>
            {children}
        </UploadContext.Provider>
    );
}

export function useUpload() {
    const context = useContext(UploadContext);
    if (!context) {
        throw new Error("useUpload must be used within an UploadProvider");
    }
    return context;
}
