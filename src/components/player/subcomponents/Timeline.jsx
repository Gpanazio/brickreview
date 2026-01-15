import { useVideo } from "../../../context/VideoContext";
import { parseTimestampSeconds } from "../../../utils/time";

export function Timeline() {
  const { currentTime, duration, seekTo, comments, activeRange } = useVideo();

  const getCommentRange = (comment) => {
    if (!comment || comment.timestamp === null) return null;
    const start = parseTimestampSeconds(comment.timestamp);
    const end = parseTimestampSeconds(comment.timestamp_end);
    if (start === null) return null;
    return { start, end };
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (duration > 0) {
      seekTo(pos * duration);
    }
  };

  return (
    <div className="w-full h-2 bg-zinc-900 cursor-pointer relative group" onClick={handleSeek}>
      <div
        className="absolute top-0 left-0 h-full bg-red-600"
        style={{
          width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
        }}
      />

      {comments.map((comment) => {
        const range = getCommentRange(comment);
        if (!range || range.end === null || duration === 0) return null;
        const startPct = (range.start / duration) * 100;
        const endPct = (range.end / duration) * 100;
        return (
          <div
            key={`range-${comment.id}`}
            className="absolute top-0 h-full bg-red-600/40 border-l border-r border-white/60 z-0 pointer-events-none"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />
        );
      })}

      {/* New Active Range Feedback */}
      {activeRange && duration > 0 && (
        <div
          className="absolute top-0 h-full bg-red-500/30 border-l border-r border-red-500 z-20 pointer-events-none"
          style={{
            left: `${(activeRange.start / duration) * 100}%`,
            width: `${((activeRange.end - activeRange.start) / duration) * 100}%`,
          }}
        />
      )}

      {comments.map((comment) => {
        const ts = parseTimestampSeconds(comment.timestamp);
        if (ts === null || duration === 0) return null;
        const left = Math.min(100, (ts / duration) * 100);

        return (
          <div
            key={`marker-${comment.id}`}
            className="absolute top-0 w-[2px] h-full bg-white/40 group-hover:bg-white/60 z-10 transition-colors"
            style={{ left: `${left}%` }}
          />
        );
      })}

      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          left: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
        }}
      />
    </div>
  );
}
