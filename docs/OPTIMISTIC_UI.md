# Optimistic UI Implementation

## Overview

The BRICK Review application implements **Optimistic UI** patterns that allow the interface to react instantly before server responses. This provides a more responsive and fluid user experience.

## How It Works

1. **Immediate Update**: When a user performs an action (e.g., adds a comment), the UI updates immediately with the expected result.
2. **Background Request**: The actual server request is sent in the background.
3. **Confirmation or Rollback**: If the server confirms the action, the optimistic item is replaced with the real one. If the server fails, the UI rolls back to the previous state.

## Core Hooks

### `useOptimisticMutation`
The base hook that provides the optimistic update pattern.

```jsx
const { mutate, isPending, error } = useOptimisticMutation({
  mutationFn: (data) => fetch(...),
  onMutate: (data) => ({ previousData }), // Return rollback context
  onSuccess: (result, data, context) => { ... },
  onError: (error, data, context) => { ... }, // Rollback here
  onSettled: () => { ... },
});
```

### Specialized Hooks

| Hook | Operations | File |
|------|------------|------|
| `useOptimisticComments` | Add, Edit, Delete, Reply | `src/hooks/useOptimisticComments.js` |
| `useOptimisticProjects` | Create, Update, Delete | `src/hooks/useOptimisticProjects.js` |
| `useOptimisticVideos` | Delete, Move, Archive, Status | `src/hooks/useOptimisticVideos.js` |
| `useOptimisticFolders` | Create, Move, Delete, Rename | `src/hooks/useOptimisticFolders.js` |
| `useOptimisticDrawings` | Add, Delete, Clear Frame | `src/hooks/useOptimisticDrawings.js` |

## Usage Examples

### Adding a Comment (Optimistic)

```jsx
// Before: Traditional approach (wait for server)
const addComment = async (content) => {
  const response = await fetch('/api/comments', { ... });
  if (response.ok) {
    const comment = await response.json();
    setComments(prev => [...prev, comment]);
    toast.success("Comment added!");
  }
};

// After: Optimistic approach (instant feedback)
const { addComment } = useOptimisticComments({
  setComments,
  videoId: currentVideoId,
});

const handleAddComment = async (content) => {
  // Form clears immediately, comment appears instantly
  await addComment.mutate({ body: { content, ... } });
  // Success/error handled by hook with automatic rollback
};
```

### Creating a Project (Optimistic)

```jsx
const { createProject } = useOptimisticProjects({
  setProjects,
});

const handleCreate = async (projectData) => {
  // Dialog closes, project card appears instantly
  setIsDialogOpen(false);
  await createProject.mutate({ project: projectData });
};
```

## Visual Indicators

Optimistic items are marked with an `_isOptimistic: true` flag. You can use this to show a subtle visual indicator:

```jsx
<div className={`comment-card ${comment._isOptimistic ? 'opacity-70' : ''}`}>
  {comment._isOptimistic && (
    <span className="text-xs text-zinc-500 animate-pulse">Sending...</span>
  )}
  {/* ... */}
</div>
```

## Temporary IDs

Optimistic items use temporary IDs (prefixed with `temp_`) until they receive real IDs from the server:

```js
import { generateTempId, isTempId } from './hooks/useOptimisticMutation';

const tempId = generateTempId(); // "temp_1674123456_abc123"
isTempId(tempId); // true
isTempId(123); // false
```

## Error Handling

All hooks automatically:
1. Show error toasts via `sonner`
2. Rollback state to previous values
3. Log errors to console for debugging

## Best Practices

1. **Clear forms immediately** - Don't wait for server response
2. **Use the `_isOptimistic` flag** for visual feedback
3. **Always provide rollback context** in `onMutate`
4. **Don't show loading spinners** for optimistic operations (they should feel instant)
5. **Reserve loading indicators** for truly blocking operations (initial data fetches)

## Implementation Status

| Component | Optimistic Operations | Status |
|-----------|----------------------|--------|
| ProjectsPage | Create Project | ✅ |
| CommentSidebar | Add, Edit, Delete, Reply | ✅ |
| ProjectDetailPage | Videos, Folders | 🔄 Planned |
| StoragePage | Files, Folders | 🔄 Planned |
| PortfolioPage | Collections | 🔄 Planned |
