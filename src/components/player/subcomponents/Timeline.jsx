import { useState, useRef } from "react";
import { useVideo } from "../../../context/VideoContext";
import { parseTimestampSeconds, formatTimecode } from "../../../utils/time";
import { useVttThumbnails } from "../../../hooks/useVttThumbnails";

export function Timeline() {
  const { currentTime, duration, seekTo, comments, activeRange, currentVideo } = useVideo();
  const thumbnails = useVttThumbnails(currentVideo?.sprite_vtt_url);

  const [hoverData, setHoverData] = useState(null);
  const timelineRef = useRef(null);

  // Check if video is being processed
  const isProcessing = currentVideo && (currentVideo.status === "pending" || currentVideo.status === "processing");
  const hasSprites = currentVideo?.sprite_vtt_url;

  const getCommentRange = (comment) => {
    if (!comment || comment.timestamp === null) return null;
    const start = parseTimestampSeconds(comment.timestamp);
    const end = parseTimestampSeconds(comment.timestamp_end);
    if (start === null) return null;
    return { start, end };
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (duration > 0) {
      seekTo(pos * duration);
    }
  };

  const handleMouseMove = (e) => {
    if (!timelineRef.current || duration <= 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, offsetX / rect.width));
    const time = percent * duration;

    const thumb = thumbnails.find((t) => time >= t.start && time < t.end);

    setHoverData({
      x: offsetX,
      time,
      thumb,
      containerWidth: rect.width,
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  return (
    <div className="w-full flex flex-col relative group select-none bg-black border-t border-white/5 pt-1">
      {hoverData && (
        <div
          className="absolute bottom-full mb-4 pointer-events-none z-50 flex flex-col items-center"
          style={{
            left: hoverData.x,
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-zinc-900 border border-zinc-700 shadow-[0_0_20px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden p-1">
            {hoverData.thumb ? (
              <div
                style={{
                  width: hoverData.thumb.w,
                  height: hoverData.thumb.h,
                  backgroundImage: `url(${hoverData.thumb.url})`,
                  backgroundPosition: `-${hoverData.thumb.x}px -${hoverData.thumb.y}px`,
                  backgroundSize: "auto",
                }}
                className="bg-black"
              />
            ) : (
              <div className="w-32 h-20 bg-zinc-800 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2">
                {isProcessing && !hasSprites ? (
                  <>
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] uppercase tracking-wider">Processando...</span>
                  </>
                ) : (
                  <span>Sem preview</span>
                )}
              </div>
            )}

            <div className="bg-zinc-950 text-center py-1 mt-1 border-t border-zinc-800">
              <span className="text-white text-xs font-mono font-bold tracking-wider">
                {formatTimecode(hoverData.time)}
              </span>
            </div>
          </div>

          <div className="w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700 transform rotate-45 -mt-1.5 z-10"></div>
        </div>
      )}

      <div
        ref={timelineRef}
        className="w-full h-2 hover:h-3 bg-zinc-800 cursor-pointer relative transition-all duration-200 ease-out z-20 group/redline"
        onClick={handleSeek}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="absolute inset-0 bg-zinc-900" />

        <div
          className="absolute top-0 left-0 h-full bg-red-600 transition-[width] duration-75 ease-linear shadow-[0_0_10px_rgba(220,38,38,0.5)]"
          style={{
            width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
          }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.4)]" />
        </div>

        {hoverData && (
          <div
            className="absolute top-0 h-full w-[1px] bg-white/50 pointer-events-none mix-blend-screen z-30"
            style={{ left: hoverData.x }}
          />
        )}
      </div>

      <div
        className="w-full h-6 relative cursor-pointer group/track transition-colors hover:bg-white/5"
        onClick={handleSeek}
      >
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 group-hover/track:bg-white/20 transition-colors -translate-y-1/2" />

        {comments.map((comment) => {
          const ts = parseTimestampSeconds(comment.timestamp);
          if (ts === null || duration === 0) return null;

          const leftPercent = Math.min(100, (ts / duration) * 100);
          const range = getCommentRange(comment);
          const hasRange = range && range.end !== null;
          const widthPercent = hasRange ? ((range.end - range.start) / duration) * 100 : 0;

          const isActive = comment.id === activeRange?.commentId;

          return (
            <div
              key={`marker-${comment.id}`}
              className="absolute top-0 h-full flex items-center group/marker"
              style={{ left: `${leftPercent}%` }}
            >
              {hasRange && (
                <div
                  className={`absolute h-1.5 rounded-full backdrop-blur-sm transition-colors cursor-ew-resize ${
                    isActive
                      ? "bg-red-600/40 border border-red-600/50"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                  style={{
                    left: 0,
                    width: `${Math.max(widthPercent, 0.2)}vw`,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
              )}

              <div
                className={`
                  relative z-10 -translate-x-1/2 
                  transition-all duration-200 ease-out
                  border border-black/50 shadow-sm
                  ${
                    isActive
                      ? "w-3 h-3 bg-red-600 scale-110 shadow-[0_0_8px_rgba(220,38,38,0.6)] ring-2 ring-red-900"
                      : "w-1.5 h-1.5 bg-zinc-400 group-hover/marker:bg-white group-hover/marker:scale-150"
                  }
                  rounded-full
                `}
              >
                <div className="absolute -inset-2 bg-transparent cursor-pointer" />
              </div>

              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/marker:block z-50 pointer-events-none">
                <div className="bg-zinc-900 border border-zinc-800 text-white text-[10px] px-2 py-1 rounded-sm shadow-xl whitespace-nowrap flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-400">
                    <span>{comment.username || comment.visitor_name || "Guest"}</span>
                    <span className="w-0.5 h-0.5 bg-zinc-600 rounded-full" />
                    <span className="text-red-500">{formatTimecode(ts)}</span>
                  </div>
                  <div className="text-zinc-300 max-w-[150px] truncate">{comment.content}</div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-b border-r border-zinc-800 rotate-45" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
