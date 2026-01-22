import { useEffect } from "react";

export function useVideoShortcuts({
    playerRef,
    isPlaying,
    currentTime,
    duration,
    frameTime = 1 / 30,
}) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            const activeElement = document.activeElement;
            const isInputFocused =
                activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA";
            if (isInputFocused) return;

            const player = playerRef.current?.plyr;
            if (!player) return;

            switch (e.key) {
                case " ":
                    e.preventDefault();
                    isPlaying ? player.pause() : player.play();
                    break;
                case "f":
                case "F":
                    if (player.fullscreen) {
                        player.fullscreen.exit();
                    } else {
                        player.fullscreen.enter();
                    }
                    break;
                case "j":
                case "J":
                    e.preventDefault();
                    if (isPlaying) {
                        player.pause();
                    }
                    player.currentTime = Math.max(0, currentTime - 0.1);
                    break;
                case "k":
                case "K":
                    e.preventDefault();
                    player.pause();
                    break;
                case "l":
                case "L":
                    e.preventDefault();
                    if (!isPlaying) {
                        player.play();
                    }
                    player.currentTime = Math.min(duration || 0, currentTime + 0.1);
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    if (e.shiftKey) {
                        player.currentTime = Math.max(0, currentTime - 1);
                    } else {
                        player.currentTime = Math.max(0, currentTime - frameTime);
                    }
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    if (e.shiftKey) {
                        player.currentTime = Math.min(duration || 0, currentTime + 1);
                    } else {
                        player.currentTime = Math.min(duration || 0, currentTime + frameTime);
                    }
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPlaying, currentTime, duration, frameTime, playerRef]);
}
