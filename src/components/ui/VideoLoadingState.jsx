import { motion } from "framer-motion";
import { Loader2, Film } from "lucide-react";

export function VideoLoadingState({ message = "Carregando..." }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center gap-4 relative">
                {/* Decorative elements */}
                <div className="absolute inset-0 border border-red-900/20 blur-xl rounded-full" />

                {/* Main Spinner */}
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 border-2 border-zinc-800 rounded-full border-t-red-600"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="w-6 h-6 text-red-600/50" />
                    </div>
                </div>

                {/* Text */}
                <div className="flex flex-col items-center gap-1">
                    <span className="brick-title text-sm text-white uppercase tracking-widest animate-pulse">
                        {message}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-mono">
                        Buffering Stream
                    </span>
                </div>

                {/* Progress Bar (Fake/Indeterminate) */}
                <div className="w-32 h-[1px] bg-zinc-900 overflow-hidden mt-2">
                    <motion.div
                        className="h-full bg-red-600/50"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>
            </div>
        </div>
    );
}
