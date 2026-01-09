import { useState, useRef, useEffect } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, ChevronRight, MessageSquare, Clock, Send, 
  CheckCircle, AlertCircle, History
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function VideoPlayer({ video, onBack }) {
  const [comments, setComments] = useState(video.comments || []);
  const [newComment, setNewComment] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState(video.latest_approval_status || 'pending');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const playerRef = useRef(null);
  const { token } = useAuth();

  const plyrOptions = {
    controls: [
      'play-large', 'play', 'progress', 'current-time', 
      'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
    ],
    keyboard: { focused: true, global: true },
    tooltips: { controls: true, seek: true }
  };

  const handleTimeUpdate = (e) => {
    setCurrentTime(e.detail.plyr.currentTime);
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          video_id: video.id,
          content: newComment,
          timestamp: currentTime
        })
      });

      if (response.ok) {
        const comment = await response.json();
        setComments([...comments, comment].sort((a, b) => a.timestamp - b.timestamp));
        setNewComment('');
      }
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
    }
  };

  const seekTo = (time) => {
    if (playerRef.current?.plyr) {
      playerRef.current.plyr.currentTime = time;
      playerRef.current.plyr.play();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApproval = async (status) => {
    setIsSubmittingApproval(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          video_id: video.id,
          status,
          notes: status === 'approved' ? 'Approved by client' : 'Changes requested by client'
        })
      });

      if (response.ok) {
        setApprovalStatus(status);
        fetchHistory();
      }
    } catch (error) {
      console.error('Erro ao processar aprovação:', error);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/reviews/${video.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  return (
    <div className="flex h-full bg-[#050505] overflow-hidden">
      {/* Área do Player */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-zinc-800/50 glass-panel flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="brick-title text-lg tracking-tighter uppercase truncate">{video.title}</h2>
          
          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`rounded-none border px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-all ${
                    approvalStatus === 'approved' ? 'border-green-500/50 text-green-500 bg-green-500/10' :
                    approvalStatus === 'changes_requested' ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' :
                    'border-zinc-700 text-zinc-400 bg-zinc-900'
                  }`}
                >
                  {approvalStatus === 'approved' ? <CheckCircle className="w-3 h-3 mr-2" /> :
                   approvalStatus === 'changes_requested' ? <AlertCircle className="w-3 h-3 mr-2" /> : null}
                  {approvalStatus.replace('_', ' ')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-48">
                <DropdownMenuItem 
                  onClick={() => handleApproval('approved')}
                  className="text-green-500 focus:text-green-400 focus:bg-green-500/10 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                >
                  <CheckCircle className="w-3 h-3 mr-2" /> Approve Video
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleApproval('changes_requested')}
                  className="text-amber-500 focus:text-amber-400 focus:bg-amber-500/10 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                >
                  <AlertCircle className="w-3 h-3 mr-2" /> Request Changes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowHistory(!showHistory)}
              className={`h-8 w-8 rounded-none border border-zinc-800 ${showHistory ? 'bg-red-600 text-white border-red-600' : 'text-zinc-500'}`}
            >
              <History className="w-4 h-4" />
            </Button>

            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-2 py-1.5 h-8 flex items-center">
              v{video.version_number}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-black flex items-center justify-center p-8">
          <div className="w-full max-w-5xl aspect-video shadow-2xl ring-1 ring-white/10">
            <Plyr
              ref={playerRef}
              source={{
                type: 'video',
                sources: [{ src: video.r2_url, type: video.mime_type }]
              }}
              options={plyrOptions}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        </div>

        {/* Barra de Controles Customizados (Frame by Frame) */}
        <div className="p-4 border-t border-zinc-800/50 glass-panel flex items-center justify-center gap-8">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-zinc-500 hover:text-white"
            onClick={() => { if (playerRef.current?.plyr) playerRef.current.plyr.currentTime -= 1/video.fps }}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> -1 FRAME
          </Button>
          <div className="brick-tech text-red-600 font-bold text-xl tabular-nums">
            {formatTime(currentTime)}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-zinc-500 hover:text-white"
            onClick={() => { if (playerRef.current?.plyr) playerRef.current.plyr.currentTime += 1/video.fps }}
          >
            +1 FRAME <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Barra Lateral de Comentários / Histórico */}
      <div className="w-96 border-l border-zinc-800/50 glass-panel flex flex-col relative z-20">
        <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
          <h3 className="brick-title text-sm uppercase tracking-widest flex items-center gap-2 text-white">
            {showHistory ? (
              <><History className="w-4 h-4 text-red-600" /> History</>
            ) : (
              <><MessageSquare className="w-4 h-4 text-red-600" /> Comments ({comments.length})</>
            )}
          </h3>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] font-black uppercase tracking-tighter text-zinc-500 hover:text-white transition-colors"
          >
            {showHistory ? 'View Comments' : 'View History'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {showHistory ? (
            history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
                No history recorded yet.
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="glass-card p-4 border-l-2 border-l-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      item.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      item.status === 'approved' ? 'text-green-500' : 'text-amber-500'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium mb-1">{item.notes}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    <span>{item.username}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
                No comments yet. Go to a specific frame and start the discussion.
              </div>
            ) : (
              comments.map((comment) => (
                <div 
                  key={comment.id} 
                  className="group glass-card p-3 border-l-2 border-l-transparent hover:border-l-red-600 cursor-pointer transition-all"
                  onClick={() => seekTo(comment.timestamp)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">
                      {formatTime(comment.timestamp)}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {comment.username}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{comment.content}</p>
                </div>
              ))
            )
          )}
        </div>

        {/* Input de Novo Comentário */}
        {!showHistory && (
          <div className="p-4 border-t border-zinc-800/50 bg-white/5">
            <form onSubmit={addComment} className="flex flex-col gap-3">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center justify-between">
                Commenting at <span className="text-red-500">{formatTime(currentTime)}</span>
              </div>
              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write your feedback..."
                  className="w-full bg-[#0a0a0a] border border-zinc-800 p-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-24"
                />
                <button 
                  type="submit"
                  disabled={!newComment.trim()}
                  className="absolute bottom-3 right-3 text-red-600 disabled:text-zinc-700 hover:text-red-500 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
