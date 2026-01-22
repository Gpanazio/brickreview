/**
 * Optimistic Drawings Hook
 * Provides optimistic UI for drawing operations (add, delete, undo, clear frame)
 */
import { useOptimisticMutation, generateTempId } from './useOptimisticMutation';
import { toast } from 'sonner';

/**
 * Hook for optimistic drawing operations
 * @param {Object} options
 * @param {Function} options.setDrawings - State setter for drawings array
 * @param {number} options.videoId - Current video ID
 * @param {boolean} options.isGuest - Whether the user is a guest
 * @param {string} options.shareToken - Share token for guest access
 * @param {string} options.sharePassword - Share password for guest access
 */
export function useOptimisticDrawings({
    setDrawings,
    videoId,
    isGuest = false,
    shareToken = null,
    sharePassword = null,
}) {
    // ADD DRAWING - Optimistic
    const addDrawingMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const endpoint = isGuest
                ? `/api/shares/${shareToken}/drawings`
                : '/api/drawings';

            const headers = { 'Content-Type': 'application/json' };
            if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(data.drawing),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao salvar desenho');
            }

            return response.json();
        },

        onMutate: (data) => {
            const tempId = generateTempId();
            const optimisticDrawing = {
                id: tempId,
                video_id: videoId,
                ...data.drawing,
                created_at: new Date().toISOString(),
                _isOptimistic: true,
            };

            let previousDrawings;
            setDrawings((prev) => {
                previousDrawings = prev;
                return [...prev, optimisticDrawing];
            });

            return { previousDrawings, tempId };
        },

        onSuccess: (result, data, context) => {
            setDrawings((prev) =>
                prev.map((d) => (d.id === context.tempId ? { ...result, _isOptimistic: false } : d))
            );
        },

        onError: (error, data, context) => {
            if (context?.previousDrawings) {
                setDrawings(context.previousDrawings);
            }
            // Don't show toast for drawings - they're rapid updates
            console.error('Erro ao salvar desenho:', error);
        },
    });

    // DELETE DRAWING (Undo) - Optimistic
    const deleteDrawingMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const endpoint = isGuest
                ? `/api/shares/${shareToken}/drawings/${data.drawingId}`
                : `/api/drawings/${data.drawingId}`;

            const headers = {};
            if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

            const response = await fetch(endpoint, { method: 'DELETE', headers });

            if (!response.ok) {
                throw new Error('Erro ao desfazer traço');
            }

            return { success: true };
        },

        onMutate: (data) => {
            let previousDrawings;
            let deletedDrawing;

            setDrawings((prev) => {
                previousDrawings = prev;
                deletedDrawing = prev.find((d) => d.id === data.drawingId);
                return prev.filter((d) => d.id !== data.drawingId);
            });

            return { previousDrawings, deletedDrawing };
        },

        onSuccess: () => {
            // Silent success for undo operations
        },

        onError: (error, data, context) => {
            if (context?.previousDrawings) {
                setDrawings(context.previousDrawings);
            }
            toast.error('Erro ao desfazer traço');
        },
    });

    // CLEAR FRAME - Optimistic (delete all drawings at a specific timestamp)
    const clearFrameMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            // Delete all drawings at the current timestamp
            const deletePromises = data.drawingIds.map((id) => {
                const endpoint = isGuest
                    ? `/api/shares/${shareToken}/drawings/${id}`
                    : `/api/drawings/${id}`;

                const headers = {};
                if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

                return fetch(endpoint, { method: 'DELETE', headers });
            });

            await Promise.all(deletePromises);
            return { success: true };
        },

        onMutate: (data) => {
            let previousDrawings;

            setDrawings((prev) => {
                previousDrawings = prev;
                return prev.filter((d) => !data.drawingIds.includes(d.id));
            });

            return { previousDrawings, drawingIds: data.drawingIds };
        },

        onSuccess: () => {
            toast.success('Desenhos limpos!');
        },

        onError: (error, data, context) => {
            if (context?.previousDrawings) {
                setDrawings(context.previousDrawings);
            }
            toast.error('Erro ao limpar desenhos');
        },
    });

    return {
        addDrawing: addDrawingMutation,
        deleteDrawing: deleteDrawingMutation,
        clearFrame: clearFrameMutation,
    };
}

export default useOptimisticDrawings;
