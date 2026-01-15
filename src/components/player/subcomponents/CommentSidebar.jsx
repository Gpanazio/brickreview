import { useState, useRef, useMemo, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useVideo } from "../../../context/VideoContext";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Clock,
  History,
  Reply,
  CornerDownRight,
  Trash2,
  Pencil,
  Smile,
  Paperclip,
  X,
  Pencil as PencilIcon,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "emoji-picker-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const CollapsibleText = ({ text, className, limit = 280 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;
  if (text.length <= limit) return <p className={className}>{text}</p>;

  return (
    <div>
      <p className={className}>
        {isExpanded ? text : `${text.slice(0, limit)}...`}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white mt-1 transition-colors"
      >
        {isExpanded ? "Ler menos" : "Ler mais"}
      </button>
    </div>
  );
};

// CommentItemInline - Direct props version (no react-window itemData destructuring)
const CommentItemInline = ({
  comment,
  seekTo,
  canEditComment,
  canDeleteComment,
  handleEditComment,
  handleDeleteComment,
  setReplyingTo,
  replyingTo,
  addReply,
  replyText,
  setReplyText,
  visitorName,
  setVisitorName,
  isGuest,
  canComment,
  isDrawingMode,
  setIsDrawingMode,
  parseTimestampSeconds,
  formatTime,
  editingComment,
  setEditingComment,
}) => {
  if (!comment) return null;

  return (
    <div className="space-y-2">
      <div
        className="group glass-card p-3 border-l-2 border-l-transparent hover:border-l-red-600 transition-all cursor-pointer"
        onClick={(e) => {
          const target = e.target;
          if (target?.closest?.("[data-comment-actions]")) return;
          if (target?.closest?.("button, a, input, textarea, form, label")) return;

          const ts = parseTimestampSeconds(comment.timestamp);
          if (ts !== null) seekTo(ts);
        }}
      >
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-red-600 uppercase tracking-tighter brick-tech font-mono">
              {parseTimestampSeconds(comment.timestamp) !== null ? (
                comment.timestamp_end && parseTimestampSeconds(comment.timestamp_end) !== null ? (
                  `${formatTime(parseTimestampSeconds(comment.timestamp))} - ${formatTime(parseTimestampSeconds(comment.timestamp_end))}`
                ) : (
                  formatTime(parseTimestampSeconds(comment.timestamp))
                )
              ) : "—"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                {comment.username}
              </span>
              {(canEditComment(comment) || canDeleteComment(comment)) && (
                <div className="flex items-center gap-1">
                  {canEditComment(comment) && (
                    <button
                      type="button"
                      data-comment-actions
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingComment(editingComment === comment.id ? null : comment.id);
                      }}
                      className="text-zinc-600 hover:text-blue-500 transition-colors cursor-pointer"
                      title="Editar comentário"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {canDeleteComment(comment) && (
                    <button
                      type="button"
                      data-comment-actions
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComment(comment.id);
                      }}
                      className="text-zinc-600 hover:text-red-500 transition-colors cursor-pointer"
                      title="Excluir comentário"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {editingComment === comment.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const editContent = e.target.elements.editContent.value;
                if (editContent.trim()) {
                  handleEditComment(comment.id, editContent.trim());
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-2"
            >
              <textarea
                name="editContent"
                defaultValue={comment.content}
                autoFocus
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-600 transition-colors resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest py-2 transition-colors cursor-pointer"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-black uppercase tracking-widest py-2 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <CollapsibleText
              text={comment.content}
              className="text-sm text-zinc-300 leading-relaxed"
            />
          )}
        </div>

        {canComment && (
          <div data-comment-actions onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
              }}
              className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Reply className="w-3 h-3" />
              {replyingTo === comment.id ? "Cancelar" : "Responder"}
            </button>

            {replyingTo === comment.id && (
              <form
                onSubmit={addReply}
                onClick={(e) => e.stopPropagation()}
                className="mt-3 space-y-2"
              >
                {isGuest && canComment && (
                  <input
                    type="text"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                    required={isGuest}
                  />
                )}
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => {
                    if (isDrawingMode) setIsDrawingMode(false);
                  }}
                  placeholder="Escreva sua resposta..."
                  className="w-full bg-[#0a0a0a] border border-zinc-800 p-2 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-16"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="w-full glass-button-primary disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-black uppercase tracking-widest py-2.5 flex items-center justify-center gap-2 group"
                >
                  <span>Enviar Resposta</span>
                  <Reply className="w-3 h-3 group-hover:-scale-x-100 transition-transform duration-300" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 space-y-2 border-l-2 border-zinc-800/50 pl-3">
          {comment.replies.map((reply) => (
            <div
              key={reply.id}
              className="glass-card p-3 bg-zinc-900/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <CornerDownRight className="w-3 h-3 text-zinc-600" />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {reply.username}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 brick-tech font-mono">
                    {new Date(reply.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {(canEditComment(reply) || canDeleteComment(reply)) && (
                    <div className="flex items-center gap-1">
                      {canEditComment(reply) && (
                        <button
                          type="button"
                          data-comment-actions
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingComment(editingComment === reply.id ? null : reply.id);
                          }}
                          className="text-zinc-600 hover:text-blue-500 transition-colors"
                          title="Editar comentário"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {canDeleteComment(reply) && (
                        <button
                          type="button"
                          data-comment-actions
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComment(reply.id);
                          }}
                          className="text-zinc-600 hover:text-red-500 transition-colors"
                          title="Excluir comentário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {editingComment === reply.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const editContent = e.target.elements.editContent.value;
                    if (editContent.trim()) {
                      handleEditComment(reply.id, editContent.trim());
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                >
                  <textarea
                    name="editContent"
                    defaultValue={reply.content}
                    autoFocus
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest py-2 transition-colors"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingComment(null);
                      }}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-black uppercase tracking-widest py-2 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <CollapsibleText
                  text={reply.content}
                  className="text-xs text-zinc-400 leading-relaxed"
                  limit={200}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function CommentSidebar({
  showHistory,
  setShowHistory,
  history,
  // Props opcionais - se fornecidas, usam elas; senão, usam o contexto
  propCurrentVideo,
  propCurrentTime,
  propComments,
  propSetComments,
  propIsDrawingMode,
  propSetIsDrawingMode,
  propSeekTo,
  propVisitorName,
  propSetVisitorName,
  propDrawings,
  propSetDrawings,
  propShareToken,
  propSharePassword,
  propIsPublic,
  propIsComparing,
  propIsRangeMode,
  propSetIsRangeMode,
  propRangeStartTime,
  propSetRangeStartTime,
  propRangeEndTime,
  propSetRangeEndTime,
  propHasTimestamp,
  propSetHasTimestamp,
}) {
  // Tenta usar o contexto, com fallback para props
  let contextValues = {};
  try {
    contextValues = useVideo();
  } catch (e) {
    // Contexto não disponível, usaremos as props
  }

  const currentVideo = propCurrentVideo || contextValues.currentVideo;
  const currentTime = propCurrentTime ?? contextValues.currentTime ?? 0;
  const comments = propComments || contextValues.comments || [];
  const setComments = propSetComments || contextValues.setComments || (() => { });
  const isDrawingMode = propIsDrawingMode ?? contextValues.isDrawingMode ?? false;
  const setIsDrawingMode = propSetIsDrawingMode || contextValues.setIsDrawingMode || (() => { });
  const selectedColor = contextValues.selectedColor || "#ff0000";
  const setSelectedColor = contextValues.setSelectedColor || (() => { });
  const isComparing = propIsComparing ?? contextValues.isComparing ?? false;
  const seekTo = propSeekTo || contextValues.seekTo || (() => { });
  const visitorName = propVisitorName ?? contextValues.visitorName ?? "";
  const setVisitorName = propSetVisitorName || contextValues.setVisitorName || (() => { });
  const drawings = propDrawings || contextValues.drawings || [];
  const setDrawings = propSetDrawings || contextValues.setDrawings || (() => { });
  const shareToken = propShareToken ?? contextValues.shareToken;
  const sharePassword = propSharePassword ?? contextValues.sharePassword;
  const isPublic = propIsPublic ?? contextValues.isPublic ?? false;
  const activeRange = contextValues.activeRange;
  const setActiveRange = contextValues.setActiveRange || (() => { });

  // Range States Mapping (Props -> Context)
  const isRangeMode = propIsRangeMode ?? false;
  const setIsRangeMode = propSetIsRangeMode || (() => { });
  const rangeStartTime = propRangeStartTime ?? null;
  const setRangeStartTime = propSetRangeStartTime || (() => { });
  const rangeEndTime = propRangeEndTime ?? null;
  const setRangeEndTime = propSetRangeEndTime || (() => { });
  const hasTimestamp = propHasTimestamp ?? true;
  const setHasTimestamp = propSetHasTimestamp || (() => { });

  const { token } = useAuth();
  const isGuest = isPublic || !token;
  const canComment = true; // Logic can be refined
  const currentVideoId = currentVideo?.id;

  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const fileInputRef = useRef(null);

  // Hook para scrubber de timecode (drag horizontal para ajustar tempo)
  const useTimecodeScrubber = (initialValue, onChange, minValue = 0, maxValue = Infinity) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const dragStartValue = useRef(0);

    const handleMouseDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartValue.current = initialValue;
      document.body.style.cursor = 'ew-resize';
    };

    const handleTouchStart = (e) => {
      e.preventDefault(); // Prevents scrolling while dragging
      e.stopPropagation();
      setIsDragging(true);
      dragStartX.current = e.touches[0].clientX;
      dragStartValue.current = initialValue;
    };

    useEffect(() => {
      if (!isDragging) return;

      const mouseSensitivity = 0.2;

      const handleMouseMove = (e) => {
        const deltaX = e.clientX - dragStartX.current;
        const newValue = Math.max(minValue, Math.min(maxValue,
          dragStartValue.current + (deltaX * mouseSensitivity)
        ));
        onChange(newValue);
      };

      const handleTouchMove = (e) => {
        const deltaX = e.touches[0].clientX - dragStartX.current;
        const newValue = Math.max(minValue, Math.min(maxValue,
          dragStartValue.current + (deltaX * mouseSensitivity)
        ));
        onChange(newValue);
      };

      const handleEnd = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.userSelect = 'none';

      // Add both listeners to handle whichever input method started validly
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }, [isDragging, onChange, minValue, maxValue]);

    return { handleMouseDown, handleTouchStart, isDragging };
  };

  // Aplicar scrubber ao range OUT
  const outScrubber = useTimecodeScrubber(
    rangeEndTime || currentTime,
    (newTime) => {
      setRangeEndTime(newTime);
      setActiveRange({ start: rangeStartTime || currentTime, end: newTime });
      seekTo(newTime);
    },
    0,
    currentVideo?.duration || 9999
  );

  // Helper functions
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimecode = (seconds) => {
    // Simplified timecode for sidebar display
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const parseTimestampSeconds = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const compareCommentsByTimestamp = (a, b) => {
    const aTs = parseTimestampSeconds(a?.timestamp);
    const bTs = parseTimestampSeconds(b?.timestamp);

    if (aTs === null && bTs === null) {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    if (aTs === null) return 1;
    if (bTs === null) return -1;
    if (aTs !== bTs) return aTs - bTs;

    return new Date(a.created_at) - new Date(b.created_at);
  };

  const getGuestCommentIds = () => {
    try {
      const ids = localStorage.getItem("brickreview_guest_comment_ids");
      return ids ? JSON.parse(ids) : [];
    } catch (_) {
      return [];
    }
  };

  const addGuestCommentId = (id) => {
    const ids = getGuestCommentIds();
    localStorage.setItem("brickreview_guest_comment_ids", JSON.stringify([...ids, id]));
  };

  const removeGuestCommentId = (id) => {
    const ids = getGuestCommentIds().filter((savedId) => savedId !== id);
    localStorage.setItem("brickreview_guest_comment_ids", JSON.stringify(ids));
  };

  const canDeleteComment = (comment) => {
    if (!isGuest) return true;
    return getGuestCommentIds().includes(comment.id);
  };

  const canEditComment = (comment) => {
    if (!isGuest) return true;
    return getGuestCommentIds().includes(comment.id);
  };

  // Actions
  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (isGuest && !visitorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    try {
      if (isGuest && visitorName.trim()) {
        localStorage.setItem("brickreview_visitor_name", visitorName.trim());
      }

      const endpoint = isGuest ? `/api/shares/${shareToken}/comments` : "/api/comments";
      const headers = { "Content-Type": "application/json" };

      if (isGuest && sharePassword) headers["x-share-password"] = sharePassword;
      if (!isGuest) headers["Authorization"] = `Bearer ${token}`;

      let finalStart = hasTimestamp ? (isRangeMode && rangeStartTime !== null ? rangeStartTime : currentTime) : null;
      let finalEnd = hasTimestamp && isRangeMode && rangeEndTime !== null ? rangeEndTime : null;

      // Inverter se o usuário marcou o range para trás
      if (finalStart !== null && finalEnd !== null && finalEnd < finalStart) {
        const temp = finalStart;
        finalStart = finalEnd;
        finalEnd = temp;
      }

      const body = {
        video_id: currentVideoId,
        content: newComment,
        timestamp: finalStart,
        timestamp_end: finalEnd,
      };

      if (isGuest) body.visitor_name = visitorName;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const comment = await response.json();
        if (isGuest) addGuestCommentId(comment.id);
        setComments((prev) => [...prev, comment].sort(compareCommentsByTimestamp));
        setNewComment("");
        setAttachedFile(null);
        setIsDrawingMode(false);
        setIsRangeMode(false);
        setRangeEndTime(null);
        setActiveRange(null);
        toast.success("Comentário adicionado!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao adicionar comentário");
      }
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    }
  };

  const addReply = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!replyText.trim() || !replyingTo) return;

    if (isGuest && !visitorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    try {
      if (isGuest && visitorName.trim()) {
        localStorage.setItem("brickreview_visitor_name", visitorName.trim());
      }
      const endpoint = isGuest ? `/api/shares/${shareToken}/comments` : "/api/comments";
      const headers = { "Content-Type": "application/json" };

      if (isGuest && sharePassword) headers["x-share-password"] = sharePassword;
      if (!isGuest) headers["Authorization"] = `Bearer ${token}`;

      const body = {
        video_id: currentVideoId,
        content: replyText,
        timestamp: currentTime,
        parent_comment_id: replyingTo,
      };

      if (isGuest) body.visitor_name = visitorName;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const reply = await response.json();
        if (isGuest) addGuestCommentId(reply.id);
        setComments((prev) => [...prev, reply]);
        setReplyText("");
        setReplyingTo(null);
        setIsDrawingMode(false);
        toast.success("Resposta adicionada!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao adicionar resposta");
      }
    } catch (error) {
      console.error("Erro ao adicionar resposta:", error);
      toast.error("Erro ao adicionar resposta");
    }
  };

  const handleEditComment = async (commentId, newContent) => {
    const endpoint = isGuest
      ? `/api/shares/${shareToken}/comments/${commentId}`
      : `/api/comments/${commentId}`;

    const headers = { "Content-Type": "application/json" };
    if (isGuest && sharePassword) headers["x-share-password"] = sharePassword;
    if (!isGuest) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content: newContent }),
    });

    if (response.ok) {
      const updatedComment = await response.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updatedComment : c)));
      setEditingComment(null);
      setIsRangeMode(false);
      setRangeEndTime(null);
      setActiveRange(null);
      toast.success("Comentário atualizado!");
    } else {
      const data = await response.json().catch(() => ({}));
      toast.error(data.error || "Erro ao atualizar comentário");
    }
  };

  const handleDeleteComment = (commentId) => {
    setConfirmDialog({
      isOpen: true,
      title: "Excluir comentário",
      message: "Tem certeza que deseja excluir este comentário?",
      onConfirm: async () => {
        const deleteToast = toast.loading("Excluindo comentário...");
        try {
          const endpoint = isGuest
            ? `/api/shares/${shareToken}/comments/${commentId}`
            : `/api/comments/${commentId}`;

          const headers = { "Content-Type": "application/json" };
          if (isGuest && sharePassword) headers["x-share-password"] = sharePassword;
          if (!isGuest) headers["Authorization"] = `Bearer ${token}`;

          const response = await fetch(endpoint, {
            method: "DELETE",
            headers,
          });

          if (!response.ok) {
            toast.error("Erro ao excluir comentário", { id: deleteToast });
            return;
          }

          if (isGuest) removeGuestCommentId(commentId);

          toast.success("Comentário excluído", { id: deleteToast });
          setComments((prev) =>
            prev.filter(
              (c) =>
                String(c.id) !== String(commentId) &&
                String(c.parent_comment_id) !== String(commentId)
            )
          );
          if (String(replyingTo) === String(commentId)) {
            setReplyingTo(null);
            setReplyText("");
          }
        } catch (error) {
          console.error("Erro ao excluir comentário:", error);
          toast.error("Erro ao excluir comentário", { id: deleteToast });
        }
      },
    });
  };

  const clearDrawing = () => {
    setDrawings(drawings.filter((d) => Math.abs(d.timestamp - currentTime) > 0.1));
  };

  const sortedComments = useMemo(() => {
    try {
      const parentComments = comments.filter((c) => c.parent_comment_id == null);
      return parentComments
        .sort((a, b) => {
          const aTs = parseTimestampSeconds(a?.timestamp);
          const bTs = parseTimestampSeconds(b?.timestamp);

          if (aTs === null && bTs === null) {
            return new Date(a.created_at) - new Date(b.created_at);
          }
          if (aTs === null) return -1;
          if (bTs === null) return 1;
          if (aTs !== bTs) return aTs - bTs;

          return new Date(a.created_at) - new Date(b.created_at);
        })
        .map((parent) => ({
          ...parent,
          replies: comments
            .filter(
              (c) =>
                c.parent_comment_id != null && String(c.parent_comment_id) === String(parent.id)
            )
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        }));
    } catch (error) {
      console.error("Erro ao organizar comentários:", error);
      return [];
    }
  }, [comments]);

  return (
    <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-800/50 glass-panel flex flex-col relative z-20 min-h-[40vh] lg:h-full lg:min-h-0 flex-1 lg:flex-none overflow-hidden">
      <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <h3 className="brick-title text-sm uppercase tracking-widest flex items-center gap-2 text-white">
          {showHistory ? (
            <>
              <History className="w-4 h-4 text-red-600" /> Histórico
            </>
          ) : (
            <>
              <MessageSquare className="w-4 h-4 text-red-600" /> Comentários <span className="brick-tech font-mono text-xs ml-1">({comments.length})</span>
            </>
          )}
        </h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs font-black uppercase tracking-tighter text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          {showHistory ? "Ver Comentários" : "Ver Histórico"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {showHistory ? (
          history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
              Nenhum histórico registrado ainda.
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {history.map((item, index) => (
                <div key={item.id || index} className="glass-card p-4 border-l-2 border-l-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-2 h-2 rounded-full ${item.status === "approved" ? "bg-green-500" : "bg-zinc-500"}`}
                    />
                    <span
                      className={`text-xs font-black uppercase tracking-widest ${item.status === "approved" ? "text-green-500" : "text-zinc-400"}`}
                    >
                      {item.status === "approved" ? "Aprovado" : "Em aprovação"}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium mb-1">{item.notes}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-500 uppercase font-bold tracking-widest">
                    <span>{item.username}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
            Nenhum comentário ainda. Vá para um frame específico e comece a discussão.
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {sortedComments.map((comment) => (
              <CommentItemInline
                key={comment.id}
                comment={comment}
                seekTo={seekTo}
                canEditComment={canEditComment}
                canDeleteComment={canDeleteComment}
                handleEditComment={handleEditComment}
                handleDeleteComment={handleDeleteComment}
                setReplyingTo={setReplyingTo}
                replyingTo={replyingTo}
                addReply={addReply}
                replyText={replyText}
                setReplyText={setReplyText}
                visitorName={visitorName}
                setVisitorName={setVisitorName}
                isGuest={isGuest}
                canComment={canComment}
                isDrawingMode={isDrawingMode}
                setIsDrawingMode={setIsDrawingMode}
                parseTimestampSeconds={parseTimestampSeconds}
                formatTime={formatTime}
                editingComment={editingComment}
                setEditingComment={setEditingComment}
              />
            ))}
          </div>
        )}
      </div>

      {!showHistory && (
        <div className="p-4 border-t border-zinc-800/50 bg-white/5">
          <form onSubmit={addComment} className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-between">
              {hasTimestamp ? (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span className="text-red-500 brick-tech font-mono">
                    {isRangeMode && rangeEndTime !== null ? (
                      `${formatTimecode(rangeStartTime || currentTime)} - ${formatTimecode(rangeEndTime)}`
                    ) : (
                      formatTimecode(currentTime)
                    )}
                  </span>
                </div>
              ) : (
                <div className="text-zinc-500">Comentário geral (sem timestamp)</div>
              )}
              <span className="text-zinc-600">Deixe seu comentário...</span>
            </div>

            {isGuest && canComment && (
              <input
                type="text"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                required={isGuest}
              />
            )}

            <div className="relative">
              {attachedFile && (
                <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-2 py-1">
                  <Paperclip className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-zinc-300 truncate max-w-[150px]">
                    {attachedFile.name}
                  </span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-zinc-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onFocus={() => {
                  if (isDrawingMode) setIsDrawingMode(false);
                }}
                placeholder={isGuest ? "Escreva seu comentário..." : "Escreva seu feedback..."}
                className="w-full bg-[#0a0a0a] border border-zinc-800 p-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-20"
                disabled={isGuest && !canComment}
              />

              <div className="bg-[#0a0a0a] border border-zinc-800 border-t-0 p-2 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                    <button
                      type="button"
                      className={`p-2 rounded-sm transition-colors cursor-pointer ${hasTimestamp
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                      onClick={() => setHasTimestamp(!hasTimestamp)}
                      title={hasTimestamp ? "Remover timestamp" : "Adicionar timestamp"}
                    >
                      {hasTimestamp ? <Clock className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>

                    {hasTimestamp && (
                      <button
                        type="button"
                        className={`p-2 rounded-sm transition-colors flex items-center gap-1 cursor-pointer ${isRangeMode ? "text-red-500 bg-red-500/10" : "text-zinc-500"}`}
                        onClick={() => {
                          if (!isRangeMode) {
                            // Ao entrar no modo range, o ponto inicial (IN) fica fixo no tempo atual
                            const start = currentTime;
                            const end = Math.min(currentVideo.duration || start + 5, start + 5);
                            setRangeStartTime(start);
                            setRangeEndTime(end);
                            setActiveRange({ start, end });
                          } else {
                            setRangeStartTime(null);
                            setRangeEndTime(null);
                            setActiveRange(null);
                          }
                          setIsRangeMode(!isRangeMode);
                        }}
                      >
                        <span className="text-[10px] font-black uppercase border border-current px-1 leading-tight">
                          Range
                        </span>
                      </button>
                    )}

                    {hasTimestamp && isRangeMode && (
                      <div className="flex items-center gap-2 bg-zinc-900 px-2 py-1 rounded-sm border border-zinc-800 shrink-0">
                        <span className="text-[9px] font-black opacity-50 uppercase text-zinc-400">OUT:</span>

                        {/* Timecode Scrubber - Arrastar horizontalmente para ajustar */}
                        <div
                          onMouseDown={outScrubber.handleMouseDown}
                          onTouchStart={outScrubber.handleTouchStart}
                          className={`
                            px-2 py-0.5 rounded cursor-ew-resize select-none transition-all
                            ${outScrubber.isDragging
                              ? 'bg-red-600/30 text-red-300 scale-105'
                              : 'hover:bg-zinc-800 text-white hover:text-red-400'
                            }
                          `}
                          title="Arrastar ← → para ajustar tempo"
                        >
                          <span className="font-mono text-[11px] font-bold brick-tech">
                            {formatTime(rangeEndTime)}
                          </span>
                        </div>
                      </div>
                    )}

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={(e) => setAttachedFile(e.target.files[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2 rounded-sm transition-colors cursor-pointer ${attachedFile
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                      title="Anexar arquivo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        className={`p-2 rounded-sm transition-colors cursor-pointer ${showEmojiPicker
                          ? "text-yellow-500 bg-yellow-500/10"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          }`}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Adicionar emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-2 z-50">
                          <ErrorBoundary>
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                setNewComment(newComment + emojiData.emoji);
                                setShowEmojiPicker(false);
                              }}
                              theme="dark"
                              width={300}
                              height={400}
                            />
                          </ErrorBoundary>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`p-2 rounded-sm transition-colors cursor-pointer ${isDrawingMode
                        ? "text-red-500 bg-red-500/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        } ${isComparing ? "opacity-40 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (!isComparing) setIsDrawingMode(!isDrawingMode);
                      }}
                      title="Desenhar no frame"
                      disabled={isComparing}
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>

                    {isDrawingMode && (
                      <div className="flex items-center gap-1 ml-1 pl-1 border-l border-zinc-800">
                        {["#FF0000", "#FFA500", "#FFFF00", "#00FF00", "#0000FF", "#FFFFFF"].map(
                          (color) => (
                            <button
                              key={color}
                              type="button"
                              className={`w-4 h-4 rounded-sm border transition-all cursor-pointer ${selectedColor === color
                                ? "border-white scale-110"
                                : "border-zinc-700 hover:border-zinc-500"
                                }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setSelectedColor(color)}
                              title={`Cor: ${color}`}
                            />
                          )
                        )}
                        <button
                          type="button"
                          className="p-1 rounded-sm text-zinc-500 hover:text-red-500 transition-colors cursor-pointer"
                          onClick={clearDrawing}
                          title="Limpar desenho"
                        >
                          <Eraser className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newComment.trim() && !attachedFile && !isDrawingMode}
                  className="w-full py-3 glass-button-primary disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-sm disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  <span>Enviar Comentário</span>
                  <CornerDownRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {isGuest && !canComment && (
              <p className="text-xs text-zinc-600 italic">
                Este compartilhamento é somente visualização.
              </p>
            )}
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}
