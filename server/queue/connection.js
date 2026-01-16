import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    if (times > 5 && process.env.NODE_ENV !== 'production') {
      console.warn("⚠️ Redis connection failed multiple times. Disabling automatic retries to save resources.");
      return null; // Stop retrying
    }
    return delay;
  },
});

connection.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

connection.on("connect", () => {
  console.log("✅ Connected to Redis");
});

export default connection;
