/**
 * Optimistic UI Hooks - Barrel Export
 * 
 * These hooks provide instant UI feedback before server responses, 
 * with automatic rollback on failure.
 */

export {
    useOptimisticMutation,
    generateTempId,
    isTempId
} from './useOptimisticMutation';

export { useOptimisticComments } from './useOptimisticComments';
export { useOptimisticProjects } from './useOptimisticProjects';
export { useOptimisticVideos } from './useOptimisticVideos';
export { useOptimisticFolders } from './useOptimisticFolders';
export { useOptimisticDrawings } from './useOptimisticDrawings';
