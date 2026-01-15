import { Queue } from "bullmq";
import connection from "./connection.js";
import { logger } from "../utils/logger.js";
import { FEATURES } from "../config/features.js";

export const videoProcessingQueue = new Queue("video-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// FIX: Recebe objeto de dados para passar ao worker corretamente
export const addVideoJob = async (videoId, { r2Key, projectId }) => {
  return await videoProcessingQueue.add("process-video", {
    videoId,
    r2Key, // Passando explicitamente para o job.data
    projectId, // Passando explicitamente para o job.data
  });
};

// Helper seguro com verificação de Feature Flag e Redis
export const addVideoJobSafe = async (videoId, data) => {
  // Verifica Flag e se a URL do Redis está presente
  if (!process.env.REDIS_URL || !FEATURES.USE_VIDEO_QUEUE) {
    throw new Error("Queue disabled or Redis not configured");
  }

  try {
    const job = await addVideoJob(videoId, data);
    logger.info("QUEUE", `Job enfileirado: ${job.id}`, { videoId });
    return job;
  } catch (error) {
    logger.error("QUEUE", `Falha ao enfileirar job`, { videoId, error: error.message });
    throw error;
  }
};
