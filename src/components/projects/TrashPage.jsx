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
    <div className="flex flex-col items-center justify-center p-12 text-zinc-500 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-lg">
      <Trash2 className="w-12 h-12 mb-4 opacity-50" />
      <p className="text-sm uppercase tracking-widest font-bold">A lixeira está vazia</p>
    </div>
  );

  const TrashSection = ({ title, items, type }) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          {type === 'project' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
          {type === 'folder' && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
          {type === 'video' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
          {type === 'file' && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
          {title} ({items.length})
        </h2>
        <div className="grid gap-2">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/50 hover:border-zinc-700 transition-all group rounded-lg"
            >
              <div className="flex flex-col">
                <span className="text-zinc-200 font-medium">{item.name}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                  Deletado em: {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  onClick={() => handleRestore(type, item.id)}
                  variant="outline"
                  size="sm"
                  className="h-8 border-green-900/30 bg-green-900/10 text-green-500 hover:text-green-400 hover:bg-green-900/30 uppercase text-[10px] tracking-widest font-bold"
                >
                  <RotateCcw className="w-3 h-3 mr-2" />
                  Restaurar
                </Button>
                <Button
                  onClick={() => handlePermanentDelete(type, item.id)}
                  variant="destructive"
                  size="sm"
                  className="h-8 bg-red-900/10 text-red-500 hover:bg-red-900/30 border border-red-900/30 uppercase text-[10px] tracking-widest font-bold"
                >
                  <X className="w-3 h-3 mr-2" />
                  Excluir
                </Button>
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
    <div className="flex flex-col h-full bg-[#050505] min-h-screen">
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
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">
                Gerenciar itens deletados
              </p>
            </div>
          </div>

          <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-full border border-red-500/20">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {!hasItems ? (
            <EmptyState />
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-lg flex items-start gap-4 mb-8">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-orange-500 font-bold text-sm uppercase tracking-wide">Atenção</h3>
                  <p className="text-orange-200/60 text-xs mt-1">Itens na lixeira podem ser excluídos permanentemente a qualquer momento. Restaure o que você precisa.</p>
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
