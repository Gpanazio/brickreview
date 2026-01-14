import { useVideo } from "../../../context/VideoContext";
import { parseTimestampSeconds } from "../../../utils/time";

export function Timeline() {
  const { currentTime, duration, seekTo, comments } = useVideo();

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
