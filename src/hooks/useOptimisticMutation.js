/**
 * useOptimisticMutation - A hook for implementing Optimistic UI updates
 * 
 * The interface reacts INSTANTLY before server response, providing immediate feedback.
 * On failure, the state is automatically rolled back to the previous state.
 * 
 * Usage:
 * const { mutate, isPending, error } = useOptimisticMutation({
 *   mutationFn: (data) => fetch(...),
 *   onMutate: (data) => ({ previousData }), // Called before mutation, return rollback data
 *   onSuccess: (result, data, context) => { ... }, // Called on success
 *   onError: (error, data, context) => { ... }, // Called on error, context contains rollback data
 *   onSettled: () => { ... }, // Called after mutation completes (success or error)
 * });
 */
import { useState, useCallback } from 'react';

export function useOptimisticMutation({
    mutationFn,
    onMutate,
    onSuccess,
    onError,
    onSettled,
}) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState(null);

    const mutate = useCallback(async (data) => {
        setIsPending(true);
        setError(null);

        // Execute optimistic update and get rollback context
        let context;
        try {
            context = onMutate?.(data);
        } catch (e) {
            console.error('[useOptimisticMutation] onMutate error:', e);
        }

        try {
            const result = await mutationFn(data);

            // Call success handler
            try {
                onSuccess?.(result, data, context);
            } catch (e) {
                console.error('[useOptimisticMutation] onSuccess error:', e);
            }

            return result;
        } catch (err) {
            setError(err);

            // Call error handler with rollback context
            try {
                onError?.(err, data, context);
            } catch (e) {
                console.error('[useOptimisticMutation] onError error:', e);
            }

            throw err;
        } finally {
            setIsPending(false);

            try {
                onSettled?.();
            } catch (e) {
                console.error('[useOptimisticMutation] onSettled error:', e);
            }
        }
    }, [mutationFn, onMutate, onSuccess, onError, onSettled]);

    const reset = useCallback(() => {
        setError(null);
        setIsPending(false);
    }, []);

    return {
        mutate,
        mutateAsync: mutate,
        isPending,
        isLoading: isPending, // Alias for compatibility
        error,
        reset,
    };
}

/**
 * Helper to generate a temporary ID for optimistic items
 */
export function generateTempId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper to check if an ID is temporary
 */
export function isTempId(id) {
    return typeof id === 'string' && id.startsWith('temp_');
}

export default useOptimisticMutation;
