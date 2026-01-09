import { useState, useRef, useEffect } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MessageSquare, Clock, Send } from 'lucide-react';

export function VideoPlayer({ video, onBack }) {
  const [comments, setComments] = useState(video.comments || []);
  const [newComment, setNewComment] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef(null);
  const { token, user } = useAuth();

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

  return (
    <div className="flex h-full bg-[#050505] overflow-hidden">
      {/* Área do Player */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-zinc-800/50 glass-panel flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="brick-title text-lg tracking-tighter uppercase truncate">{video.title}</h2>
          <div className="ml-auto text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-1">
            v{video.version_number}
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

      {/* Barra Lateral de Comentários */}
      <div className="w-96 border-l border-zinc-800/50 glass-panel flex flex-col">
        <div className="p-6 border-b border-zinc-800/50">
          <h3 className="brick-title text-sm uppercase tracking-widest flex items-center gap-2 text-white">
            <MessageSquare className="w-4 h-4 text-red-600" /> Comments ({comments.length})
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {comments.map((comment) => (
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
          ))}
          {comments.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
              No comments yet. Go to a specific frame and start the discussion.
            </div>
          )}
        </div>

        {/* Input de Novo Comentário */}
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
      </div>
    </div>
  );
}
