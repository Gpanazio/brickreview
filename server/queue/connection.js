import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

connection.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

connection.on("connect", () => {
  console.log("✅ Connected to Redis");
});

export default connection;
