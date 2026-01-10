import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar ação",
  message = "Tem certeza que deseja continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger" // "danger" or "warning"
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md glass-panel border-zinc-800 p-8 z-10"
        >
          {/* Icon */}
          <div className={`w-12 h-12 flex items-center justify-center mb-6 ${
            variant === 'danger' ? 'bg-red-600/10' : 'bg-amber-600/10'
          }`}>
            <AlertTriangle className={`w-6 h-6 ${
              variant === 'danger' ? 'text-red-500' : 'text-amber-500'
            }`} />
          </div>

          {/* Title */}
          <h2 className="brick-title text-xl text-white mb-2 tracking-tighter uppercase">
            {title}
          </h2>

          {/* Message */}
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            {message}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={onClose}
              variant="ghost"
              className="flex-1 h-12 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-none uppercase tracking-widest text-xs font-black"
            >
              {cancelText}
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 h-12 border-none rounded-none uppercase tracking-widest text-xs font-black ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {confirmText}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
