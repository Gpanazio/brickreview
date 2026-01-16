import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { motion } from "framer-motion";
import { ChevronLeft, HardDrive, Database, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SettingsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [storageStats, setStorageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStorageStats = async () => {
    try {
      setRefreshing(true);
      const response = await fetch("/api/storage/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStorageStats(data);
      } else {
        toast.error("Erro ao carregar estatísticas de armazenamento");
      }
    } catch (error) {
      console.error("Error fetching storage stats:", error);
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStorageStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatSize = (sizeData) => {
    if (!sizeData) return "0 B";
    return `${sizeData.value} ${sizeData.unit}`;
  };

  const getUsageColor = (percentage) => {
    if (percentage < 70) return "bg-green-600";
    if (percentage < 90) return "bg-yellow-600";
    return "bg-red-600";
  };

  const getUsageTextColor = (percentage) => {
    if (percentage < 70) return "text-green-500";
    if (percentage < 90) return "text-yellow-500";
    return "text-red-500";
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="h-10 w-10 animate-spin border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <header className="border-b border-zinc-800/20 glass-panel px-4 py-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

        <div className="flex items-center gap-6 relative z-10">
          <motion.div
            whileHover={{ x: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800/50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </motion.div>

          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="brick-title text-2xl md:text-4xl tracking-tighter uppercase leading-none mb-2"
            >
              Armazenamento
            </motion.h1>
            <div className="flex items-center gap-2">
              <span className="h-[1px] w-4 bg-red-600" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em] font-black">
                Sistema • Armazenamento
              </p>
            </div>
          </div>

          <Button
            onClick={fetchStorageStats}
            disabled={refreshing}
            className="glass-button-primary border-none rounded-none px-6 h-10 font-black uppercase tracking-widest text-xs"
          >
            <RefreshCw className={`w-4 h-4 mr-3 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Storage Overview */}
          <div className="glass-panel border border-zinc-800/30 rounded-none p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-600/20 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="brick-title text-lg uppercase tracking-tighter text-white">
                  Armazenamento Total
                </h2>
                <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest">
                  Todos os buckets R2
                </p>
              </div>
            </div>

            {storageStats && (
              <div className="space-y-6">
                {/* Total Storage Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400 uppercase tracking-wider font-bold">
                      {formatSize(storageStats.total.usedFormatted)} usado de{" "}
                      {formatSize(storageStats.total.limitFormatted)}
                    </span>
                    <span
                      className={`text-sm font-bold ${getUsageTextColor(storageStats.total.usedPercentage)}`}
                    >
                      {storageStats.total.usedPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-4 bg-zinc-900 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${storageStats.total.usedPercentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${getUsageColor(storageStats.total.usedPercentage)} transition-colors`}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-950/50 p-4 border-l-2 border-l-red-600">
                    <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                      Disponível
                    </p>
                    <p className="brick-title text-xl text-white">
                      {formatSize(storageStats.total.availableFormatted)}
                    </p>
                  </div>
                  <div className="bg-zinc-950/50 p-4 border-l-2 border-l-blue-600">
                    <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                      Total de Arquivos
                    </p>
                    <p className="brick-title text-xl text-white">
                      {storageStats.total.objectCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-zinc-950/50 p-4 border-l-2 border-l-green-600">
                    <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                      Buckets Ativos
                    </p>
                    <p className="brick-title text-xl text-white">
                      {storageStats.r2.buckets.length}
                    </p>
                  </div>
                  <div className="bg-zinc-950/50 p-4 border-l-2 border-l-purple-600">
                    <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest mb-1">
                      Limite Total
                    </p>
                    <p className="brick-title text-xl text-white">
                      {formatSize(storageStats.total.limitFormatted)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Individual Buckets */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-5 h-5 text-zinc-500" />
              <h3 className="brick-title text-md uppercase tracking-tighter text-white">
                Armazenamento R2
              </h3>
            </div>

            {storageStats?.r2.buckets.map((bucket, index) => (
              <motion.div
                key={bucket.bucketId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-panel border border-zinc-800/30 rounded-none p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="brick-title text-md text-white mb-1">{bucket.bucketName}</h4>
                    <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest">
                      {bucket.bucketId === "primary" ? "Bucket Principal" : "Bucket Secundário"}
                    </p>
                  </div>
                  {bucket.error && (
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs">Erro ao obter dados</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                        {formatSize(bucket.usedFormatted)} usado de{" "}
                        {formatSize(bucket.limitFormatted)}
                      </span>
                      <span
                        className={`text-xs font-bold ${getUsageTextColor(bucket.usedPercentage)}`}
                      >
                        {bucket.usedPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-zinc-900 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bucket.usedPercentage}%` }}
                        transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                        className={`h-full ${getUsageColor(bucket.usedPercentage)}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-950/30 p-3 border-l border-l-zinc-800">
                      <p className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">
                        Disponível
                      </p>
                      <p className="text-sm text-zinc-300 font-bold">
                        {formatSize(bucket.availableFormatted)}
                      </p>
                    </div>
                    <div className="bg-zinc-950/30 p-3 border-l border-l-zinc-800">
                      <p className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">
                        Arquivos
                      </p>
                      <p className="text-sm text-zinc-300 font-bold">
                        {bucket.objectCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-zinc-950/30 p-3 border-l border-l-zinc-800">
                      <p className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">
                        Tipo
                      </p>
                      <p className="text-sm text-zinc-300 font-bold">
                        {bucket.bucketId === "primary" ? "Principal" : "Secundário"}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Google Drive Storage */}
          {storageStats?.drive.enabled && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <HardDrive className="w-5 h-5 text-zinc-500" />
                <h3 className="brick-title text-md uppercase tracking-tighter text-white">
                  Google Drive (Backup)
                </h3>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel border border-zinc-800/30 rounded-none p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="brick-title text-md text-white mb-1">
                      {storageStats.drive.name || 'Google Drive'}
                    </h4>
                    <p className="brick-tech text-[9px] text-zinc-500 uppercase tracking-widest">
                      Backup de Longo Prazo
                    </p>
                  </div>
                  {storageStats.drive.error && (
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs">Erro ao obter dados</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                        {formatSize(storageStats.drive.usedFormatted)} usado de{" "}
                        {formatSize(storageStats.drive.limitFormatted)}
                      </span>
                      <span
                        className={`text-xs font-bold ${getUsageTextColor(storageStats.drive.usedPercentage)}`}
                      >
                        {storageStats.drive.usedPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-zinc-900 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${storageStats.drive.usedPercentage}%` }}
                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                        className={`h-full ${getUsageColor(storageStats.drive.usedPercentage)}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-950/30 p-3 border-l border-l-zinc-800">
                      <p className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">
                        Disponível
                      </p>
                      <p className="text-sm text-zinc-300 font-bold">
                        {formatSize(storageStats.drive.availableFormatted)}
                      </p>
                    </div>
                    <div className="bg-zinc-950/30 p-3 border-l border-l-zinc-800">
                      <p className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">
                        Arquivos
                      </p>
                      <p className="text-sm text-zinc-300 font-bold">
                        {storageStats.drive.objectCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-zinc-950/30 p-3 border-l border-l-zinc-800">
                      <p className="brick-tech text-[8px] text-zinc-600 uppercase tracking-widest mb-0.5">
                        Tipo
                      </p>
                      <p className="text-sm text-zinc-300 font-bold">Backup</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Info Footer */}
          <div className="bg-zinc-950/30 border border-zinc-800/30 rounded-none p-4">
            <p className="brick-tech text-[9px] text-zinc-600 uppercase tracking-widest text-center">
              {storageStats?.drive.enabled
                ? "R2: Cache Rápido (20GB) • Drive: Backup Automático (20TB) • Estatísticas em tempo real"
                : "Cloudflare R2 Free Plan: 10GB por bucket • As estatísticas são atualizadas em tempo real"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
