/**
 * Optimistic Folders Hook
 * Provides optimistic UI for folder operations (create, move, delete)
 */
import { useOptimisticMutation, generateTempId } from './useOptimisticMutation';
import { toast } from 'sonner';

/**
 * Hook for optimistic folder operations
 * @param {Object} options
 * @param {Function} options.setFolders - State setter for folders array
 * @param {number} options.projectId - Current project ID
 */
export function useOptimisticFolders({
    setFolders,
    projectId,
}) {
    // CREATE FOLDER - Optimistic
    const createFolderMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    project_id: projectId,
                    parent_folder_id: data.parentFolderId || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao criar pasta');
            }

            return response.json();
        },

        onMutate: (data) => {
            const tempId = generateTempId();
            const optimisticFolder = {
                id: tempId,
                name: data.name,
                project_id: projectId,
                parent_folder_id: data.parentFolderId || null,
                created_at: new Date().toISOString(),
                video_count: 0,
                previews: [],
                _isOptimistic: true,
            };

            let previousFolders;
            setFolders((prev) => {
                previousFolders = prev;
                return [...prev, optimisticFolder];
            });

            return { previousFolders, tempId };
        },

        onSuccess: (result, data, context) => {
            setFolders((prev) =>
                prev.map((f) => (f.id === context.tempId ? { ...result, _isOptimistic: false } : f))
            );
            toast.success('Pasta criada!');
        },

        onError: (error, data, context) => {
            if (context?.previousFolders) {
                setFolders(context.previousFolders);
            }
            toast.error(error.message || 'Erro ao criar pasta');
        },
    });

    // MOVE FOLDER - Optimistic
    const moveFolderMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/folders/${data.folderId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parent_folder_id: data.parentFolderId }),
            });

            if (!response.ok) {
                throw new Error('Erro ao mover pasta');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousFolders;
            setFolders((prev) => {
                previousFolders = prev;
                return prev.map((f) =>
                    f.id === data.folderId
                        ? { ...f, parent_folder_id: data.parentFolderId, _isOptimistic: true }
                        : f
                );
            });

            return { previousFolders };
        },

        onSuccess: (result, data) => {
            setFolders((prev) =>
                prev.map((f) =>
                    f.id === data.folderId ? { ...f, ...result, _isOptimistic: false } : f
                )
            );
            toast.success('Pasta movida!');
        },

        onError: (error, data, context) => {
            if (context?.previousFolders) {
                setFolders(context.previousFolders);
            }
            toast.error('Erro ao mover pasta');
        },
    });

    // DELETE FOLDER - Optimistic
    const deleteFolderMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/folders/${data.folderId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir pasta');
            }

            return { success: true };
        },

        onMutate: (data) => {
            let previousFolders;
            setFolders((prev) => {
                previousFolders = prev;
                return prev.filter((f) => f.id !== data.folderId);
            });

            return { previousFolders, folderId: data.folderId };
        },

        onSuccess: () => {
            toast.success('Pasta excluída');
        },

        onError: (error, data, context) => {
            if (context?.previousFolders) {
                setFolders(context.previousFolders);
            }
            toast.error('Erro ao excluir pasta');
        },
    });

    // RENAME FOLDER - Optimistic
    const renameFolderMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/folders/${data.folderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: data.newName }),
            });

            if (!response.ok) {
                throw new Error('Erro ao renomear pasta');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousFolders;
            setFolders((prev) => {
                previousFolders = prev;
                return prev.map((f) =>
                    f.id === data.folderId
                        ? { ...f, name: data.newName, _isOptimistic: true }
                        : f
                );
            });

            return { previousFolders };
        },

        onSuccess: (result, data) => {
            setFolders((prev) =>
                prev.map((f) =>
                    f.id === data.folderId ? { ...f, ...result, _isOptimistic: false } : f
                )
            );
            toast.success('Pasta renomeada!');
        },

        onError: (error, data, context) => {
            if (context?.previousFolders) {
                setFolders(context.previousFolders);
            }
            toast.error('Erro ao renomear pasta');
        },
    });

    return {
        createFolder: createFolderMutation,
        moveFolder: moveFolderMutation,
        deleteFolder: deleteFolderMutation,
        renameFolder: renameFolderMutation,
    };
}

export default useOptimisticFolders;
