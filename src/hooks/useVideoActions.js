import { useState } from "react";
import { toast } from "sonner";
import { useOptimisticMutation } from "./useOptimisticMutation";

export function useVideoActions({
    currentVideo,
    isGuest,
    shareToken,
    sharePassword,
    token,
    fetchHistory
}) {
    const currentVideoId = currentVideo?.id;
    const [approvalStatus, setApprovalStatus] = useState(
        currentVideo?.latest_approval_status || "pending"
    );
    const [shareLink, setShareLink] = useState("");
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);

    // --- DOWNLOAD ---
    const handleDownload = async (type) => {
        try {
            const headers = isGuest
                ? sharePassword
                    ? { "x-share-password": sharePassword }
                    : {}
                : {};

            const endpoint = isGuest
                ? `/api/shares/${shareToken}/video/${currentVideoId}/download?type=${type}`
                : `/api/videos/${currentVideoId}/download?type=${type}`;

            const response = await fetch(endpoint, { headers });

            if (response.ok) {
                const data = await response.json();

                const videoResponse = await fetch(data.url);
                const blob = await videoResponse.blob();
                const blobUrl = window.URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = blobUrl;
                link.download = data.filename || `${currentVideo.title}_${type}.mp4`;
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();

                setTimeout(() => {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
            }
        } catch (_error) {
            console.error("Erro ao fazer download");
        }
    };

    // --- SHARE ---
    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) { }

        // Fallback
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.select();
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            return successful;
        } catch (err) { return false; }
    };

    const handleGenerateShare = async () => {
        setIsGeneratingShare(true);
        const shareToast = toast.loading("Gerando link de compartilhamento...");

        try {
            const response = await fetch("/api/shares", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    video_id: currentVideoId,
                    access_type: "comment",
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                toast.error(errorData.error || "Erro ao gerar link", { id: shareToast });
                return;
            }

            const data = await response.json();
            if (!data.token) {
                toast.error("Token de compartilhamento não recebido", { id: shareToast });
                return;
            }

            const fullUrl = `${window.location.origin}/share/${data.token}`;
            setShareLink(fullUrl);

            const copied = await copyToClipboard(fullUrl);

            if (copied) {
                toast.success("Link copiado!", {
                    id: shareToast,
                    description: "O link de revisão já está na sua área de transferência.",
                });
            } else {
                toast.dismiss(shareToast);
                setShowShareDialog(true);
            }
        } catch (error) {
            console.error("Erro ao gerar link:", error);
            toast.error("Erro ao gerar link de compartilhamento", { id: shareToast });
        } finally {
            setIsGeneratingShare(false);
        }
    };

    // --- APPROVAL ---
    const approvalMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    video_id: currentVideoId,
                    status: data.status,
                    notes: data.status === "approved"
                        ? "Aprovado pelo cliente"
                        : "Ajustes solicitados pelo cliente",
                }),
            });

            if (!response.ok) throw new Error("Erro ao processar aprovação");
            return response.json();
        },
        onMutate: (data) => {
            const previousStatus = approvalStatus;
            setApprovalStatus(data.status);
            return { previousStatus };
        },
        onSuccess: () => {
            if (fetchHistory) fetchHistory();
        },
        onError: (_error, _data, context) => {
            if (context?.previousStatus) {
                setApprovalStatus(context.previousStatus);
            }
        },
    });

    const handleApproval = async (status) => {
        await approvalMutation.mutate({ status });
    };

    return {
        approvalStatus,
        setApprovalStatus, // Exposed in case of manual reset needed
        handleApproval,
        handleDownload,
        handleGenerateShare,
        isGeneratingShare,
        shareLink,
        showShareDialog,
        setShowShareDialog
    };
}
