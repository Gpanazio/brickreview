import IORedis from "ioredis";

let errorLogged = false;

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      errorLogged = true;
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 2000);
    return delay;
  },
});

connection.on("error", () => {
  // Suppress - errors are expected when Redis is not available
});

connection.on("connect", () => {
  errorLogged = false;
  console.log("✅ Connected to Redis (queue)");
});

// Try to connect
connection.connect().catch(() => {
  if (!errorLogged) {
    console.warn("⚠️ Redis not available, queue features disabled");
    errorLogged = true;
  }
});

export default connection;
