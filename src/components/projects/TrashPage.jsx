import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Trash2, RotateCcw, X, AlertTriangle, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageLoader } from "@/components/ui/PageLoader";

const TrashPage = () => {
  const navigate = useNavigate();
  const [trashItems, setTrashItems] = useState({
    projects: [],
    folders: [],
    videos: [],
    files: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchTrashItems = async () => {
    try {
      const response = await fetch("/api/trash");
      if (!response.ok) {
        throw new Error("Failed to fetch trash items");
      }
      const data = await response.json();
      setTrashItems(data);
    } catch (error) {
      console.error(error);
      toast.error("Falha ao carregar itens da lixeira.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashItems();
  }, []);

  const handleRestore = async (type, id) => {
    try {
      const response = await fetch(`/api/trash/${type}/${id}/restore`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to restore item");
      }
      // Refresh the list locally
      setTrashItems((prevItems) => ({
        ...prevItems,
        [type + "s"]: prevItems[type + "s"].filter((item) => item.id !== id),
      }));
      toast.success("Item restaurado com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao restaurar item.");
    }
  };

  const handlePermanentDelete = async (type, id) => {
    if (!window.confirm("Tem certeza? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const response = await fetch(`/api/trash/${type}/${id}/permanent`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to permanently delete item");
      }
      // Refresh the list locally
      setTrashItems((prevItems) => ({
        ...prevItems,
        [type + "s"]: prevItems[type + "s"].filter((item) => item.id !== id),
      }));
      toast.success("Item excluído permanentemente.");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao excluir item permanentemente.");
    }
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
      <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6 border border-zinc-800">
        <Trash2 className="w-6 h-6 opacity-30" />
      </div>
      <p className="brick-title text-sm text-zinc-500 mb-2">Lixeira Vazia</p>
      <p className="brick-tech text-[10px] uppercase tracking-widest opacity-50">Nenhum item excluído recentemente</p>
    </div>
  );

  const TrashSection = ({ title, items, type }) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6 border-b border-zinc-800/50 pb-2">
          <div className={`w-1.5 h-1.5 rounded-none ${type === 'project' ? 'bg-blue-600' :
              type === 'folder' ? 'bg-yellow-600' :
                type === 'video' ? 'bg-red-600' :
                  'bg-green-600'
            }`} />
          <h2 className="brick-tech text-xs text-zinc-400 uppercase tracking-[0.2em] font-bold">
            {title} ({items.length})
          </h2>
        </div>

        <div className="grid gap-1">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="group flex items-center justify-between p-4 bg-zinc-900/20 border-l-2 border-l-transparent hover:border-l-red-600 hover:bg-zinc-900/40 transition-all gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors uppercase tracking-tight truncate">
                  {item.name || item.title}
                </span>
                <span className="brick-tech text-[9px] text-zinc-600 uppercase tracking-widest">
                  Deletado: {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleRestore(type, item.id)}
                  className="p-2 hover:bg-green-500/10 text-zinc-500 hover:text-green-500 transition-colors uppercase text-[9px] tracking-widest font-bold flex items-center gap-1"
                  title="Restaurar"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar
                </button>
                <div className="w-[1px] h-3 bg-zinc-800" />
                <button
                  onClick={() => handlePermanentDelete(type, item.id)}
                  className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-colors uppercase text-[9px] tracking-widest font-bold flex items-center gap-1"
                  title="Excluir Permanentemente"
                >
                  <X className="w-3 h-3" />
                  Excluir
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return <PageLoader />;

  const hasItems = Object.values(trashItems).some(arr => arr.length > 0);

  return (
    <div className="flex flex-col h-full bg-[#050505] min-h-screen font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800/20 glass-panel px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

        <div className="flex items-center gap-6 relative z-10 max-w-7xl mx-auto w-full">
          <motion.div
            whileHover={{ x: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50 cursor-pointer rounded-full"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </motion.div>

          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="brick-title text-2xl md:text-3xl tracking-tighter uppercase leading-none mb-2"
            >
              Lixeira
            </motion.h1>
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-4 bg-red-600" />
              <p className="brick-tech text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">
                Gerenciar itens deletados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {hasItems && (
              <Button
                onClick={async () => {
                  if (window.confirm("ATENÇÃO: Isso excluirá PERMANENTEMENTE todos os itens da lixeira. Esta ação não pode ser desfeita. Deseja continuar?")) {
                    try {
                      setLoading(true);
                      const res = await fetch('/api/trash/empty', {
                        method: 'DELETE',
                        headers: {}
                      });
                      if (!res.ok) throw new Error('Falha ao esvaziar lixeira');
                      toast.success('Lixeira esvaziada com sucesso');
                      fetchTrashItems();
                    } catch (err) {
                      console.error(err);
                      toast.error('Erro ao esvaziar a lixeira');
                      setLoading(false);
                    }
                  }
                }}
                variant="destructive"
                className="h-8 px-4 uppercase text-[9px] tracking-[0.2em] font-black bg-red-600 hover:bg-red-700 border-none rounded-none"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Esvaziar Lixeira
              </Button>
            )}
            <div className="w-10 h-10 flex items-center justify-center bg-red-900/10 rounded-full border border-red-500/20">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {!hasItems ? (
            <EmptyState />
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-red-950/10 border-l-2 border-red-600/50 p-6 mb-12 flex items-start gap-4">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="brick-tech text-red-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">Zona de Perigo</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed max-w-xl">
                    Os itens nesta lixeira ainda ocupam espaço no armazenamento. Eles podem ser restaurados a qualquer momento, mas se você esvaziar a lixeira, eles serão perdidos para sempre.
                  </p>
                </div>
              </div>

              <TrashSection title="Projetos" items={trashItems.projects} type="project" />
              <TrashSection title="Pastas" items={trashItems.folders} type="folder" />
              <TrashSection title="Vídeos" items={trashItems.videos} type="video" />
              <TrashSection title="Arquivos" items={trashItems.files} type="file" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TrashPage;
