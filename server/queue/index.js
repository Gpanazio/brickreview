import { Queue } from "bullmq";
import connection from "./connection.js";

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

export const addVideoJob = async (videoId, fileData) => {
  return await videoProcessingQueue.add("process-video", {
    videoId,
    fileData,
  });
};
