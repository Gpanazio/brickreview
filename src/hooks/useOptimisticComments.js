/**
 * Optimistic Comments Hook
 * Provides optimistic UI for comment operations (add, edit, delete, reply)
 */
import { useCallback } from 'react';
import { useOptimisticMutation, generateTempId } from './useOptimisticMutation';
import { toast } from 'sonner';

/**
 * Hook for optimistic comment operations
 * @param {Object} options
 * @param {Function} options.setComments - State setter for comments array
 * @param {number} options.videoId - Current video ID
 * @param {boolean} options.isGuest - Whether the user is a guest
 * @param {string} options.shareToken - Share token for guest access
 * @param {string} options.sharePassword - Share password for guest access
 * @param {string} options.visitorName - Visitor name for guest comments
 */
export function useOptimisticComments({
    setComments,
    videoId,
    isGuest = false,
    shareToken = null,
    sharePassword = null,
    visitorName = '',
}) {
    // Helper: compare comments by timestamp for sorting
    const compareCommentsByTimestamp = useCallback((a, b) => {
        const aTs = a?.timestamp ?? null;
        const bTs = b?.timestamp ?? null;

        if (aTs === null && bTs === null) {
            return new Date(a.created_at) - new Date(b.created_at);
        }
        if (aTs === null) return 1;
        if (bTs === null) return -1;
        if (aTs !== bTs) return aTs - bTs;

        return new Date(a.created_at) - new Date(b.created_at);
    }, []);

    // ADD COMMENT - Optimistic
    const addCommentMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const endpoint = isGuest
                ? `/api/shares/${shareToken}/comments`
                : '/api/comments';

            const headers = { 'Content-Type': 'application/json' };
            if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(data.body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao adicionar comentário');
            }

            return response.json();
        },

        onMutate: (data) => {
            // Create optimistic comment
            const tempId = generateTempId();
            const optimisticComment = {
                id: tempId,
                video_id: videoId,
                content: data.body.content,
                timestamp: data.body.timestamp,
                timestamp_end: data.body.timestamp_end,
                username: isGuest ? visitorName : (data.body.username || 'Você'),
                visitor_name: isGuest ? visitorName : null,
                created_at: new Date().toISOString(),
                parent_comment_id: null,
                replies: [],
                _isOptimistic: true, // Flag to identify optimistic items
            };

            // Save previous state for rollback
            let previousComments;
            setComments((prev) => {
                previousComments = prev;
                return [...prev, optimisticComment].sort(compareCommentsByTimestamp);
            });

            return { previousComments, tempId };
        },

        onSuccess: (result, data, context) => {
            // Replace optimistic comment with real one
            setComments((prev) =>
                prev
                    .map((c) => (c.id === context.tempId ? { ...result, _isOptimistic: false } : c))
                    .sort(compareCommentsByTimestamp)
            );
            toast.success('Comentário adicionado!');
        },

        onError: (error, data, context) => {
            // Rollback to previous state
            if (context?.previousComments) {
                setComments(context.previousComments);
            }
            toast.error(error.message || 'Erro ao adicionar comentário');
        },
    });

    // ADD REPLY - Optimistic
    const addReplyMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const endpoint = isGuest
                ? `/api/shares/${shareToken}/comments`
                : '/api/comments';

            const headers = { 'Content-Type': 'application/json' };
            if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(data.body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao adicionar resposta');
            }

            return response.json();
        },

        onMutate: (data) => {
            const tempId = generateTempId();
            const optimisticReply = {
                id: tempId,
                video_id: videoId,
                content: data.body.content,
                timestamp: data.body.timestamp,
                parent_comment_id: data.body.parent_comment_id,
                username: isGuest ? visitorName : (data.body.username || 'Você'),
                visitor_name: isGuest ? visitorName : null,
                created_at: new Date().toISOString(),
                _isOptimistic: true,
            };

            let previousComments;
            setComments((prev) => {
                previousComments = prev;
                return [...prev, optimisticReply];
            });

            return { previousComments, tempId };
        },

        onSuccess: (result, data, context) => {
            setComments((prev) =>
                prev.map((c) => (c.id === context.tempId ? { ...result, _isOptimistic: false } : c))
            );
            toast.success('Resposta adicionada!');
        },

        onError: (error, data, context) => {
            if (context?.previousComments) {
                setComments(context.previousComments);
            }
            toast.error(error.message || 'Erro ao adicionar resposta');
        },
    });

    // EDIT COMMENT - Optimistic
    const editCommentMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const endpoint = isGuest
                ? `/api/shares/${shareToken}/comments/${data.commentId}`
                : `/api/comments/${data.commentId}`;

            const headers = { 'Content-Type': 'application/json' };
            if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ content: data.newContent }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao atualizar comentário');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousComments;
            setComments((prev) => {
                previousComments = prev;
                return prev.map((c) =>
                    c.id === data.commentId
                        ? { ...c, content: data.newContent, _isOptimistic: true }
                        : c
                );
            });

            return { previousComments };
        },

        onSuccess: (result, data) => {
            setComments((prev) =>
                prev.map((c) =>
                    c.id === data.commentId ? { ...result, _isOptimistic: false } : c
                )
            );
            toast.success('Comentário atualizado!');
        },

        onError: (error, data, context) => {
            if (context?.previousComments) {
                setComments(context.previousComments);
            }
            toast.error(error.message || 'Erro ao atualizar comentário');
        },
    });

    // DELETE COMMENT - Optimistic
    const deleteCommentMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const endpoint = isGuest
                ? `/api/shares/${shareToken}/comments/${data.commentId}`
                : `/api/comments/${data.commentId}`;

            const headers = { 'Content-Type': 'application/json' };
            if (isGuest && sharePassword) headers['x-share-password'] = sharePassword;

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir comentário');
            }

            return { success: true };
        },

        onMutate: (data) => {
            let previousComments;
            setComments((prev) => {
                previousComments = prev;
                // Remove comment and its replies
                return prev.filter(
                    (c) =>
                        String(c.id) !== String(data.commentId) &&
                        String(c.parent_comment_id) !== String(data.commentId)
                );
            });

            return { previousComments };
        },

        onSuccess: () => {
            toast.success('Comentário excluído');
        },

        onError: (error, data, context) => {
            if (context?.previousComments) {
                setComments(context.previousComments);
            }
            toast.error('Erro ao excluir comentário');
        },
    });

    return {
        addComment: addCommentMutation,
        addReply: addReplyMutation,
        editComment: editCommentMutation,
        deleteComment: deleteCommentMutation,
    };
}

export default useOptimisticComments;
