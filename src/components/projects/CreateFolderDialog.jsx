import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateFolderDialog({ isOpen, onClose, onConfirm, title = "Nova Pasta" }) {
  const [folderName, setFolderName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (folderName.trim()) {
      onConfirm(folderName.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="brick-title text-xl uppercase tracking-tighter text-white">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              Nome da Pasta
            </label>
            <Input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Digite o nome da pasta..."
              className="bg-zinc-900 border-zinc-800 rounded-none text-white focus:ring-red-600 focus:border-red-600 h-10"
            />
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="glass-button border border-zinc-800 rounded-none text-[10px] uppercase tracking-widest h-10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!folderName.trim()}
              className="glass-button-primary border-none rounded-none text-[10px] font-black uppercase tracking-widest h-10 px-6"
            >
              Criar Pasta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
