import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minimize2, Maximize2, Loader2, CheckCircle2, AlertCircle, File } from "lucide-react";

export function UploadProgressWidget({ uploads, onClose }) {
    const [isMinimized, setIsMinimized] = useState(false);
    const activeUploads = Object.values(uploads);

    if (activeUploads.length === 0) return null;

    const totalProgress = activeUploads.reduce((acc, curr) => acc + curr.progress, 0) / activeUploads.length;
    const isComplete = activeUploads.every(u => u.status === 'success' || u.status === 'error');

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto">
                <AnimatePresence mode="wait">
                    {isMinimized ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#0a0a0a] border border-zinc-800 p-4 w-64 shadow-2xl flex items-center justify-between group cursor-pointer"
                            onClick={() => setIsMinimized(false)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 flex items-center justify-center">
                                    {!isComplete ? (
                                        <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    )}
                                    {/* Circular progress could go here */}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white uppercase tracking-widest">
                                        {isComplete ? "Uploads Concluídos" : "Enviando..."}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        {activeUploads.filter(u => u.status === 'uploading').length} restantes
                                    </span>
                                </div>
                            </div>
                            <ButtonIcon icon={Maximize2} onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} />
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#0a0a0a] border border-zinc-800 w-80 md:w-96 shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="h-10 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Gerenciador de Uploads
                                </span>
                                <div className="flex items-center gap-1">
                                    <ButtonIcon icon={Minimize2} onClick={() => setIsMinimized(true)} />
                                    <ButtonIcon icon={X} onClick={onClose} />
                                </div>
                            </div>

                            {/* List */}
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-1">
                                {activeUploads.map((upload, index) => (
                                    <div key={index} className="p-3 bg-black/40 hover:bg-zinc-900/30 transition-colors group">
                                        <div className="flex items-center gap-3 mb-2">
                                            <File className="w-4 h-4 text-zinc-600" />
                                            <span className="text-xs text-zinc-300 truncate flex-1 font-medium">{upload.name}</span>
                                            {upload.status === 'uploading' && <span className="text-[10px] text-zinc-500 font-mono">{Math.round(upload.progress)}%</span>}
                                            {upload.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                            {upload.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-1 w-full bg-zinc-900 overflow-hidden">
                                            <motion.div
                                                className={`h-full ${upload.status === 'error' ? 'bg-red-900' : upload.status === 'success' ? 'bg-green-500' : 'bg-red-600'}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${upload.progress}%` }}
                                                transition={{ duration: 0.2 }}
                                            />
                                        </div>
                                        {upload.error && <p className="text-[9px] text-red-500 mt-1">{upload.error}</p>}
                                    </div>
                                ))}
                            </div>

                            {/* Footer Status */}
                            {!isComplete && (
                                <div className="p-2 border-t border-zinc-800 bg-zinc-900/20">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 text-red-600 animate-spin" />
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest">
                                            Processando arquivos...
                                        </span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function ButtonIcon({ icon: Icon, onClick }) {
    return (
        <button
            onClick={onClick}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-sm transition-colors"
        >
            <Icon className="w-3 h-3" />
        </button>
    )
}
