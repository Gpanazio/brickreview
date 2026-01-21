import { useState, useRef, useMemo, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useOptimisticComments } from "../../../hooks/useOptimisticComments";
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
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { ReactionPicker } from "./ReactionPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Constants
const DEFAULT_RANGE_DURATION_SECONDS = 5;
const DRAWING_COLORS = ["#FF0000", "#FFA500", "#FFFF00", "#00FF00", "#0000FF", "#FFFFFF"];

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
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">
                {parseTimestampSeconds(comment.timestamp) !== null
                  ? formatTime(parseTimestampSeconds(comment.timestamp))
                  : "—"}
              </span>
              {comment.timestamp_end && parseTimestampSeconds(comment.timestamp_end) !== null && (
                <>
                  <span className="text-zinc-600 text-[10px]">→</span>
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">
                    {formatTime(parseTimestampSeconds(comment.timestamp_end))}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
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
                      className="text-zinc-600 hover:text-blue-500 transition-colors"
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest py-2 transition-colors"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingComment(null);
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest py-2 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-300 leading-relaxed">{comment.content}</p>
          )}
        </div>

        {canComment && (
          <div data-comment-actions onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
              }}
              className="mt-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
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
                    className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
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
                  className="w-full bg-[#0a0a0a] border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-16"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-black uppercase tracking-widest py-2 transition-colors"
                >
                  Enviar Resposta
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
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {reply.username}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600">
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
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest py-2 transition-colors"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingComment(null);
                      }}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest py-2 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-zinc-400 leading-relaxed">{reply.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function CommentSidebar({ showHistory, setShowHistory, history }) {
  const {
    currentVideo,
    currentTime,
    comments,
    setComments,
    isDrawingMode,
    setIsDrawingMode,
    selectedColor,
    setSelectedColor,
    isComparing,
    seekTo,
    visitorName,
    setVisitorName,
    drawings,
    setDrawings,
    shareToken,
    sharePassword,
    isPublic,
  } = useVideo();

  const { token } = useAuth();
  const isGuest = isPublic || !token;
  const canComment = true; // Logic can be refined
  const currentVideoId = currentVideo.id;

  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [hasTimestamp, setHasTimestamp] = useState(true);
  const [rangeEndTime, setRangeEndTime] = useState(null);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubRef = useRef({ startX: 0, startValue: 0 });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const fileInputRef = useRef(null);

  // Optimistic UI for comment operations
  const optimisticComments = useOptimisticComments({
    setComments,
    videoId: currentVideoId,
    isGuest,
    shareToken,
    sharePassword,
    visitorName,
  });

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

  // Scrubbing Logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isScrubbing) return;
      e.preventDefault();

      const deltaX = e.clientX - scrubRef.current.startX;
      const sensitivity = 0.02; // 50px = 1s

      // Allow bidirectional scrubbing - clamp between 0 and video duration
      const rawValue = scrubRef.current.startValue + deltaX * sensitivity;
      const newValue = Math.max(0, Math.min(rawValue, currentVideo.duration || 0));

      setRangeEndTime(newValue);

      // Update video time to preview range end
      if (typeof seekTo === 'function') {
        seekTo(newValue);
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, currentTime]);

  const handleScrubStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScrubbing(true);
    scrubRef.current = {
      startX: e.clientX,
      startValue: rangeEndTime || currentTime + 5,
    };
  };

  // Actions - Using Optimistic UI
  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (isGuest && !visitorName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    // Save visitor name to localStorage
    if (isGuest && visitorName.trim()) {
      localStorage.setItem("brickreview_visitor_name", visitorName.trim());
    }

    // Handle range mode - ensure start < end even if user dragged left
    let finalTimestamp = hasTimestamp ? currentTime : null;
    let finalTimestampEnd = null;

    if (hasTimestamp && isRangeMode && rangeEndTime !== null) {
      finalTimestamp = Math.min(currentTime, rangeEndTime);
      finalTimestampEnd = Math.max(currentTime, rangeEndTime);
    }

    const body = {
      video_id: currentVideoId,
      content: newComment,
      timestamp: finalTimestamp,
      timestamp_end: finalTimestampEnd,
    };

    if (isGuest) body.visitor_name = visitorName;

    // Clear form immediately for instant feedback
    const commentContent = newComment;
    setNewComment("");
    setAttachedFile(null);
    setIsDrawingMode(false);

    try {
      const result = await optimisticComments.addComment.mutate({
        body,
        username: isGuest ? visitorName : 'Você',
      });

      // Track guest comment for edit/delete permissions
      if (isGuest && result?.id) {
        addGuestCommentId(result.id);
      }
    } catch (error) {
      // Restore form on error
      setNewComment(commentContent);
      console.error("Erro ao adicionar comentário:", error);
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

    // Save visitor name to localStorage
    if (isGuest && visitorName.trim()) {
      localStorage.setItem("brickreview_visitor_name", visitorName.trim());
    }

    const body = {
      video_id: currentVideoId,
      content: replyText,
      timestamp: currentTime,
      parent_comment_id: replyingTo,
    };

    if (isGuest) body.visitor_name = visitorName;

    // Clear form immediately for instant feedback
    const replyContent = replyText;
    const parentId = replyingTo;
    setReplyText("");
    setReplyingTo(null);
    setIsDrawingMode(false);

    try {
      const result = await optimisticComments.addReply.mutate({
        body,
        username: isGuest ? visitorName : 'Você',
      });

      // Track guest comment for edit/delete permissions
      if (isGuest && result?.id) {
        addGuestCommentId(result.id);
      }
    } catch (error) {
      // Restore form on error
      setReplyText(replyContent);
      setReplyingTo(parentId);
      console.error("Erro ao adicionar resposta:", error);
    }
  };

  const handleEditComment = async (commentId, newContent) => {
    // Close edit mode immediately for instant feedback
    setEditingComment(null);

    try {
      await optimisticComments.editComment.mutate({
        commentId,
        newContent
      });
    } catch (error) {
      // Reopen edit mode on error
      setEditingComment(commentId);
      console.error("Erro ao editar comentário:", error);
    }
  };

  const handleDeleteComment = (commentId) => {
    setConfirmDialog({
      isOpen: true,
      title: "Excluir comentário",
      message: "Tem certeza que deseja excluir este comentário?",
      onConfirm: async () => {
        // Close dialog immediately
        setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: null });

        // Clear reply state if deleting parent
        if (String(replyingTo) === String(commentId)) {
          setReplyingTo(null);
          setReplyText("");
        }

        try {
          await optimisticComments.deleteComment.mutate({ commentId });

          // Track guest comment removal
          if (isGuest) {
            removeGuestCommentId(commentId);
          }
        } catch (error) {
          console.error("Erro ao excluir comentário:", error);
        }
      },
    });
  };

  const handleUndoDrawing = async () => {
    const currentFrameDrawings = drawings.filter((d) => Math.abs(d.timestamp - currentTime) < 0.1);
    if (currentFrameDrawings.length === 0) return;

    const lastDrawing = currentFrameDrawings[currentFrameDrawings.length - 1];

    // Optimistic update
    setDrawings((prev) => prev.filter((d) => d.id !== lastDrawing.id));

    if (isGuest && !canComment) return; // Guests without permission handling? 
    // Assuming backend handles auth, but we should try/catch

    try {
      const endpoint = isGuest
        ? `/api/shares/${shareToken}/drawings/${lastDrawing.id}`
        : `/api/drawings/${lastDrawing.id}`;

      const headers = isGuest
        ? sharePassword ? { "x-share-password": sharePassword } : {}
        : {};

      const response = await fetch(endpoint, { method: "DELETE", headers });

      if (!response.ok) {
        // Revert if failed
        setDrawings((prev) => [...prev, lastDrawing]);
        toast.error("Erro ao desfazer traço");
      }
    } catch (error) {
      console.error("Erro ao desfazer:", error);
      setDrawings((prev) => [...prev, lastDrawing]);
    }
  };

  const handleClearFrame = async () => {
    const currentFrameDrawings = drawings.filter((d) => Math.abs(d.timestamp - currentTime) < 0.1);
    if (currentFrameDrawings.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: "Limpar desenhos",
      message: "Tem certeza que deseja apagar todos os desenhos deste frame?",
      onConfirm: async () => {
        // Optimistic clear
        setDrawings((prev) => prev.filter((d) => Math.abs(d.timestamp - currentTime) >= 0.1));
        const deleteToast = toast.loading("Limpando desenhos...");

        try {
          const deletePromises = currentFrameDrawings.map(d => {
            const endpoint = isGuest
              ? `/api/shares/${shareToken}/drawings/${d.id}`
              : `/api/drawings/${d.id}`;
            const headers = isGuest
              ? sharePassword ? { "x-share-password": sharePassword } : {}
              : {};
            return fetch(endpoint, { method: "DELETE", headers });
          });

          await Promise.all(deletePromises);
          toast.success("Desenhos limpos!", { id: deleteToast });
        } catch (error) {
          console.error("Erro ao limpar desenhos:", error);
          toast.error("Erro ao limpar desenhos", { id: deleteToast });
          // Restore on error (simplified, might be tricky if user drew more, but acceptable)
          // Restore on error by adding back the drawings that were removed.
          setDrawings((prev) => [...prev, ...currentFrameDrawings]);
        }
      }
    });
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
              <MessageSquare className="w-4 h-4 text-red-600" /> Comentários ({comments.length})
            </>
          )}
        </h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-[10px] font-black uppercase tracking-tighter text-zinc-500 hover:text-white transition-colors"
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
                      className={`text-[10px] font-black uppercase tracking-widest ${item.status === "approved" ? "text-green-500" : "text-zinc-400"}`}
                    >
                      {item.status === "approved" ? "Aprovado" : "Em aprovação"}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium mb-1">{item.notes}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
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
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-between">
              {hasTimestamp ? (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span className="text-red-500">{formatTimecode(currentTime)}</span>
                  {isRangeMode && rangeEndTime !== null && (
                    <>
                      <span className="text-zinc-600">→</span>
                      <span className="text-red-500">{formatTimecode(rangeEndTime)}</span>
                    </>
                  )}
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
                className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                required={isGuest}
              />
            )}

            <div className="relative w-full bg-[#0a0a0a] border border-zinc-800 focus-within:border-red-600 transition-colors flex flex-col">
              {attachedFile && (
                <div className="absolute bottom-full left-0 mb-2 flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-2 py-1">
                  <Paperclip className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] text-zinc-300 truncate max-w-[150px]">
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
                className="w-full bg-transparent border-none p-3 text-sm text-white focus:ring-0 focus:outline-none transition-colors resize-none h-24"
                disabled={isGuest && !canComment}
              />


              <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-[#0a0a0a] p-2 flex items-center justify-between gap-2 z-40">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent flex-1 min-w-0">
                  <button
                    type="button"
                    className={`p-2 rounded-sm transition-colors flex-shrink-0 ${hasTimestamp
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
                      className={`p-2 rounded-sm transition-colors flex items-center gap-1 flex-shrink-0 ${isRangeMode ? "text-red-500 bg-red-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                      onClick={() => {
                        if (!isRangeMode) {
                          setRangeEndTime(currentTime + DEFAULT_RANGE_DURATION_SECONDS);
                        } else {
                          setRangeEndTime(null);
                        }
                        setIsRangeMode(!isRangeMode);
                      }}
                      title="Definir intervalo (Range)"
                    >
                      <span className="text-[10px] font-black uppercase border border-current px-1">
                        Range
                      </span>
                    </button>
                  )}

                  {/* Range Scrubber */}
                  {hasTimestamp && isRangeMode && (
                    <div
                      className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded-sm border border-zinc-800 hover:border-red-600 hover:bg-zinc-800 transition-all select-none cursor-ew-resize active:bg-red-900/20 flex-shrink-0"
                      onMouseDown={handleScrubStart}
                      title="Arraste para ajustar o tempo final"
                    >
                      <span>Fim:</span>
                      <span className="text-white font-bold min-w-[2.5em] text-center">
                        {rangeEndTime !== null ? rangeEndTime.toFixed(1) : ""}
                      </span>
                      <span className="text-zinc-600">s</span>
                    </div>
                  )}

                  <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => setAttachedFile(e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-sm transition-colors flex-shrink-0 ${attachedFile
                      ? "text-red-500 bg-red-500/10"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                      }`}
                    title="Anexar arquivo"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      className={`p-2 rounded-sm transition-colors flex-shrink-0 ${showEmojiPicker
                        ? "text-yellow-500 bg-yellow-500/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        }`}
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="Adicionar emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-2 z-50 bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
                        {/* Quick Reactions */}
                        <div className="flex items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-950">
                          {["🎬", "📽️", "🍿", "🎞️"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="p-2 hover:bg-zinc-800 rounded-sm transition-colors text-xl leading-none"
                              onClick={() => {
                                setNewComment(newComment + emoji);
                                setShowEmojiPicker(false);
                              }}
                              title={`Adicionar ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
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
                    className={`p-2 rounded-sm transition-colors ${isDrawingMode
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
                    <div className="flex items-center gap-1 ml-2 border-l border-zinc-800 pl-2 flex-shrink-0">
                      {["#FF0000", "#FFA500", "#FFFF00", "#00FF00", "#0000FF", "#FFFFFF"].map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-4 h-4 rounded-full border transition-all ${selectedColor === color
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
                        className="p-1.5 rounded-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors ml-1"
                        onClick={handleUndoDrawing}
                        title="Desfazer último traço"
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        className="p-1.5 rounded-sm text-zinc-500 hover:text-red-500 hover:bg-zinc-800 transition-colors"
                        onClick={handleClearFrame}
                        title="Limpar todos os desenhos do frame"
                      >
                        <Eraser className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!newComment.trim() || (isGuest && !canComment)}
                  className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm transition-colors cursor-pointer"
                >
                  Enviar
                </button>
              </div>
            </div>
          </form>

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
      )}
    </div>
  );
}
