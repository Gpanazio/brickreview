/**
 * Optimistic Projects Hook
 * Provides optimistic UI for project operations (create, update, delete)
 */
import { useCallback } from 'react';
import { useOptimisticMutation, generateTempId } from './useOptimisticMutation';
import { toast } from 'sonner';

/**
 * Hook for optimistic project operations
 * @param {Object} options
 * @param {Function} options.setProjects - State setter for projects array
 * @param {Function} options.fetchProjects - Function to refetch projects from server
 */
export function useOptimisticProjects({
    setProjects,
    fetchProjects,
}) {
    // CREATE PROJECT - Optimistic
    const createProjectMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.project),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao criar projeto');
            }

            return response.json();
        },

        onMutate: (data) => {
            const tempId = generateTempId();
            const optimisticProject = {
                id: tempId,
                name: data.project.name,
                description: data.project.description || '',
                client_name: data.project.client_name || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                video_count: 0,
                _isOptimistic: true,
            };

            let previousProjects;
            setProjects((prev) => {
                previousProjects = prev;
                return [optimisticProject, ...prev];
            });

            // Show creating indicator
            toast.loading('Criando projeto...', { id: `creating-${tempId}` });

            return { previousProjects, tempId };
        },

        onSuccess: (result, data, context) => {
            // Replace optimistic project with real one
            setProjects((prev) =>
                prev.map((p) => (p.id === context.tempId ? { ...result, _isOptimistic: false } : p))
            );
            toast.success('Projeto criado com sucesso!', { id: `creating-${context.tempId}` });
        },

        onError: (error, data, context) => {
            if (context?.previousProjects) {
                setProjects(context.previousProjects);
            }
            toast.error(error.message || 'Erro ao criar projeto', { id: `creating-${context?.tempId}` });
        },
    });

    // UPDATE PROJECT - Optimistic
    const updateProjectMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/projects/${data.projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.updates),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao atualizar projeto');
            }

            return response.json();
        },

        onMutate: (data) => {
            let previousProjects;
            setProjects((prev) => {
                previousProjects = prev;
                return prev.map((p) =>
                    p.id === data.projectId
                        ? { ...p, ...data.updates, updated_at: new Date().toISOString(), _isOptimistic: true }
                        : p
                );
            });

            return { previousProjects };
        },

        onSuccess: (result, data) => {
            setProjects((prev) =>
                prev.map((p) =>
                    p.id === data.projectId ? { ...result, _isOptimistic: false } : p
                )
            );
            toast.success('Projeto atualizado!');
        },

        onError: (error, data, context) => {
            if (context?.previousProjects) {
                setProjects(context.previousProjects);
            }
            toast.error(error.message || 'Erro ao atualizar projeto');
        },
    });

    // DELETE PROJECT - Optimistic
    const deleteProjectMutation = useOptimisticMutation({
        mutationFn: async (data) => {
            const response = await fetch(`/api/projects/${data.projectId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir projeto');
            }

            return { success: true };
        },

        onMutate: (data) => {
            let previousProjects;
            setProjects((prev) => {
                previousProjects = prev;
                return prev.filter((p) => p.id !== data.projectId);
            });

            toast.loading('Excluindo projeto...', { id: `deleting-${data.projectId}` });

            return { previousProjects, projectId: data.projectId };
        },

        onSuccess: (result, data, context) => {
            toast.success('Projeto excluído', { id: `deleting-${context.projectId}` });
        },

        onError: (error, data, context) => {
            if (context?.previousProjects) {
                setProjects(context.previousProjects);
            }
            toast.error('Erro ao excluir projeto', { id: `deleting-${context?.projectId}` });
        },
    });

    return {
        createProject: createProjectMutation,
        updateProject: updateProjectMutation,
        deleteProject: deleteProjectMutation,
    };
}

export default useOptimisticProjects;
