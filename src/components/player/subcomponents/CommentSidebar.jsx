import { useState, useRef, useMemo } from "react";
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
            <span className="text-xs font-black text-red-600 uppercase tracking-tighter">
              {parseTimestampSeconds(comment.timestamp) !== null
                ? formatTime(parseTimestampSeconds(comment.timestamp))
                : "—"}
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
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-black uppercase tracking-widest py-2 transition-colors"
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
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {reply.username}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-zinc-600">
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
    activeRange,
    setActiveRange,
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

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const fileInputRef = useRef(null);

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

      const body = {
        video_id: currentVideoId,
        content: newComment,
        timestamp: hasTimestamp ? currentTime : null,
        timestamp_end: hasTimestamp && isRangeMode && rangeEndTime !== null ? rangeEndTime : null,
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
              <MessageSquare className="w-4 h-4 text-red-600" /> Comentários ({comments.length})
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
                  <span className="text-red-500">{formatTimecode(currentTime)}</span>
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
                className="w-full bg-[#0a0a0a] border border-zinc-800 p-3 pb-12 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-24"
                disabled={isGuest && !canComment}
              />

              <div className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a] p-2 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                    <button
                      type="button"
                      className={`p-2 rounded-sm transition-colors cursor-pointer ${
                        hasTimestamp
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
                            const end = Math.min(currentVideo.duration || currentTime + 5, currentTime + 5);
                            setRangeEndTime(end);
                            setActiveRange({ start: currentTime, end });
                          } else {
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
                      <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-sm border border-zinc-800 shrink-0">
                        <span className="text-[9px] font-black opacity-50 uppercase text-zinc-400">OUT:</span>
                        <input
                          type="text"
                          value={formatTime(rangeEndTime)}
                          readOnly
                          className="bg-transparent border-none text-white font-bold text-[10px] w-10 text-center focus:outline-none"
                        />
                        <div className="flex flex-col gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newVal = Math.min(currentVideo.duration || rangeEndTime + 1, rangeEndTime + 1);
                              setRangeEndTime(newVal);
                              setActiveRange(prev => ({ ...prev, end: newVal }));
                              seekTo(newVal);
                            }}
                            className="text-zinc-500 hover:text-white"
                          >
                            <span className="block h-2 flex items-center">▲</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newVal = Math.max(currentTime + 0.1, rangeEndTime - 1);
                              setRangeEndTime(newVal);
                              setActiveRange(prev => ({ ...prev, end: newVal }));
                              seekTo(newVal);
                            }}
                            className="text-zinc-500 hover:text-white"
                          >
                            <span className="block h-2 flex items-center">▼</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRangeEndTime(currentTime);
                            setActiveRange(prev => ({ ...prev, end: currentTime }));
                          }}
                          className="ml-1 text-[9px] font-bold text-zinc-500 hover:text-red-500 uppercase px-1 border border-zinc-800 hover:border-red-500/50 rounded-sm"
                          title="Marcar ponto de saída no tempo atual"
                        >
                          SET
                        </button>
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
                      className={`p-2 rounded-sm transition-colors cursor-pointer ${
                        attachedFile
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
                        className={`p-2 rounded-sm transition-colors cursor-pointer ${
                          showEmojiPicker
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
                      className={`p-2 rounded-sm transition-colors cursor-pointer ${
                        isDrawingMode
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
                              className={`w-4 h-4 rounded-sm border transition-all cursor-pointer ${
                                selectedColor === color
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
                  disabled={!newComment.trim() || (isGuest && !canComment)}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-sm transition-all active:scale-[0.98] shadow-lg shadow-red-900/20 disabled:cursor-not-allowed"
                >
                  Enviar Comentário
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
