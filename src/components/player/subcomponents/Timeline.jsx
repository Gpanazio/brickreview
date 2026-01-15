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
    <div className="w-full flex flex-col relative group select-none">
      <div
        className="w-full h-2 bg-zinc-800 cursor-pointer relative overflow-hidden transition-all group-hover:h-3"
        onClick={handleSeek}
      >
        <div
          className="absolute top-0 left-0 h-full bg-red-600 transition-[width] duration-75 ease-linear"
          style={{
            width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
          }}
        />

        <div className="absolute top-0 h-full w-[1px] bg-white opacity-0 group-hover:opacity-50 pointer-events-none mix-blend-overlay" />

        {activeRange && duration > 0 && (
          <div
            className="absolute top-0 h-full bg-white/20 border-l border-r border-white/50 z-20 pointer-events-none"
            style={{
              left: `${(Math.min(activeRange.start, activeRange.end) / duration) * 100}%`,
              width: `${(Math.abs(activeRange.end - activeRange.start) / duration) * 100}%`,
            }}
          />
        )}
      </div>

      <div className="w-full h-4 relative mt-[2px] cursor-pointer" onClick={handleSeek}>
        {comments.map((comment) => {
          const ts = parseTimestampSeconds(comment.timestamp);
          if (ts === null || duration === 0) return null;
          const left = Math.min(100, (ts / duration) * 100);

          const range = getCommentRange(comment);
          const hasRange = range && range.end !== null;
          const width = hasRange ? ((range.end - range.start) / duration) * 100 : 0;

          return (
            <div
              key={`marker-${comment.id}`}
              className="absolute h-full top-0"
              style={{ left: `${left}%` }}
            >
              {hasRange && (
                <div
                  className="absolute top-1.5 h-1 bg-zinc-600 rounded-full opacity-60"
                  style={{ width: `${Math.max(width, 0.5)}vw` }}
                />
              )}

              <div
                className="absolute top-0 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-zinc-500 hover:bg-white hover:scale-150 hover:z-50 transition-all border border-black/50"
                title={comment.content}
                style={{
                  backgroundColor: comment.id === activeRange?.commentId ? "#DC2626" : undefined,
                  zIndex: comment.id === activeRange?.commentId ? 20 : 10,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
