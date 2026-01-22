/**
 * Optimistic Videos Hook
 * Provides optimistic UI for video operations (delete, move, archive, update status)
 */
import { useOptimisticMutation } from './useOptimisticMutation';
import { toast } from 'sonner';

/**
 * Hook for optimistic video operations
 * @param {Object} options
 * @param {Function} options.setVideos - State setter for videos array
 * @param {Function} options.fetchVideos - Function to refetch videos from server
 * @param {number} options.projectId - Current project ID
 */
export function useOptimisticVideos({
    setVideos,
    fetchVideos,
    projectId,
}) {
    // DELETE VIDEO - Optimistic (move to trash)
    const deleteVideoMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/videos/${data.videoId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir vídeo');
            }

            return { success: true };
        },

        onMutate: (data) => {
            let previousVideos;
            setVideos((prev) => {
                previousVideos = prev;
                return prev.filter((v) => v.id !== data.videoId);
            });

            return { previousVideos, videoId: data.videoId };
        },

        onSuccess: (result, data, context) => {
            toast.success('Vídeo movido para a lixeira');
        },

        onError: (error, data, context) => {
            if (context?.previousVideos) {
                setVideos(context.previousVideos);
            }
            toast.error('Erro ao excluir vídeo');
        },
    });

    // MOVE VIDEO TO FOLDER - Optimistic
    const moveVideoMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/videos/${data.videoId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_id: data.folderId }),
            });

            if (!response.ok) {
                throw new Error('Erro ao mover vídeo');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousVideos;
            setVideos((prev) => {
                previousVideos = prev;
                return prev.map((v) =>
                    v.id === data.videoId
                        ? { ...v, folder_id: data.folderId, _isOptimistic: true }
                        : v
                );
            });

            return { previousVideos };
        },

        onSuccess: (result, data) => {
            setVideos((prev) =>
                prev.map((v) =>
                    v.id === data.videoId ? { ...v, ...result, _isOptimistic: false } : v
                )
            );
            toast.success('Vídeo movido!');
        },

        onError: (error, data, context) => {
            if (context?.previousVideos) {
                setVideos(context.previousVideos);
            }
            toast.error('Erro ao mover vídeo');
        },
    });

    // UPDATE VIDEO STATUS (Approval) - Optimistic
    const updateStatusMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/videos/${data.videoId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: data.status, notes: data.notes }),
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar status');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousVideos;
            setVideos?.((prev) => {
                previousVideos = prev;
                return prev.map((v) =>
                    v.id === data.videoId
                        ? { ...v, approval_status: data.status, _isOptimistic: true }
                        : v
                );
            });

            return { previousVideos };
        },

        onSuccess: (result, data) => {
            setVideos?.((prev) =>
                prev.map((v) =>
                    v.id === data.videoId ? { ...v, ...result, _isOptimistic: false } : v
                )
            );

            const statusMessages = {
                approved: 'Vídeo aprovado!',
                rejected: 'Vídeo marcado para revisão',
                pending: 'Status alterado para pendente',
            };
            toast.success(statusMessages[data.status] || 'Status atualizado!');
        },

        onError: (error, data, context) => {
            if (context?.previousVideos) {
                setVideos?.(context.previousVideos);
            }
            toast.error('Erro ao atualizar status');
        },
    });

    // ARCHIVE VIDEO - Optimistic
    const archiveVideoMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/videos/${data.videoId}/archive`, {
                method: 'PATCH',
            });

            if (!response.ok) {
                throw new Error('Erro ao arquivar vídeo');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousVideos;
            setVideos((prev) => {
                previousVideos = prev;
                return prev.map((v) =>
                    v.id === data.videoId
                        ? { ...v, is_archived: true, _isOptimistic: true }
                        : v
                );
            });

            return { previousVideos };
        },

        onSuccess: (result, data) => {
            setVideos((prev) =>
                prev.map((v) =>
                    v.id === data.videoId ? { ...v, ...result, _isOptimistic: false } : v
                )
            );
            toast.success('Vídeo arquivado!');
        },

        onError: (error, data, context) => {
            if (context?.previousVideos) {
                setVideos(context.previousVideos);
            }
            toast.error('Erro ao arquivar vídeo');
        },
    });

    return {
        deleteVideo: deleteVideoMutation,
        moveVideo: moveVideoMutation,
        updateStatus: updateStatusMutation,
        archiveVideo: archiveVideoMutation,
    };
}

export default useOptimisticVideos;
