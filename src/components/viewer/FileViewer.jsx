import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function FileViewer({ file, onClose }) {
  const isImage = file.file_type === 'image';
  const isPDF = file.mime_type === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-zinc-900 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">{file.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6 text-white" />
          </Button>
        </div>
        <div className="p-4 h-full">
          {isImage ? (
            <img src={file.r2_url} alt={file.name} className="w-full h-full object-contain" />
          ) : isPDF ? (
            <iframe src={file.r2_url} className="w-full h-full" title={file.name} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white">Formato de arquivo não suportado para visualização.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
