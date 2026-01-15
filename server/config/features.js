/**
 * Feature Flags System
 * Controla o rollout de funcionalidades críticas.
 * Default: false (safety first)
 */
export const FEATURES = {
  // Ativa o processamento via fila (BullMQ/Redis)
  USE_VIDEO_QUEUE: process.env.FEATURE_USE_VIDEO_QUEUE === "true",

  // Ativa o filtro robusto de SSRF via biblioteca (Futuro - Phase 4)
  USE_SSRF_FILTER: process.env.FEATURE_USE_SSRF_FILTER === "true",

  // Permite que o worker inicie automaticamente via script de start
  ENABLE_WORKER_AUTO_START: process.env.ENABLE_WORKER_AUTO_START === "true",
};

if (process.env.NODE_ENV !== "production") {
  console.log("[FEATURES] Configuração atual:", FEATURES);
}

export default FEATURES;
