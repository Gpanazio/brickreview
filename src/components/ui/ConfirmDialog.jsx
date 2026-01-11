import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { Input } from './input';
import { AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar ação",
  message = "Tem certeza que deseja continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger", // "danger" or "warning"
  verificationText = "",
  verificationPlaceholder = "Digite para confirmar"
}) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isVerified = !verificationText || inputValue.toLowerCase() === verificationText.toLowerCase();

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
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            {message}
          </p>

          {/* Verification Input */}
          {verificationText && (
            <div className="mb-8 space-y-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Para confirmar, digite <span className="text-white">"{verificationText}"</span> abaixo:
              </p>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={verificationPlaceholder}
                className="glass-input h-12 rounded-none border-none"
                autoFocus
              />
            </div>
          )}

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
              disabled={!isVerified}
              className={`flex-1 h-12 border-none rounded-none uppercase tracking-widest text-xs font-black transition-all ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-zinc-800 disabled:text-zinc-600'
                  : 'bg-amber-600 hover:bg-amber-700 text-white disabled:bg-zinc-800 disabled:text-zinc-600'
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
