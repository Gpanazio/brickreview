/**
 * Structured Logger
 * Padroniza logs para facilitar debug e monitoramento.
 */
export const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
  METRIC: "METRIC",
  FEATURE: "FEATURE",
};

const formatLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  // In production, output JSON for better parsing by log aggregators
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  }

  // In development, keep it human-readable
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `[${level}] ${timestamp} ${message}${metaStr}`;
};

export const logger = {
  error: (tag, message, meta) => console.error(formatLog("ERROR", `[${tag}] ${message}`, meta)),
  warn: (tag, message, meta) => console.warn(formatLog("WARN", `[${tag}] ${message}`, meta)),
  info: (tag, message, meta) => console.log(formatLog("INFO", `[${tag}] ${message}`, meta)),
  debug: (tag, message, meta) => {
    if (process.env.NODE_ENV !== "production") console.log(formatLog("DEBUG", `[${tag}] ${message}`, meta));
  },
  metric: (name, value, meta = {}) => console.log(formatLog("METRIC", `${name}: ${value}`, meta)),
  feature: (flagName, state, meta = {}) =>
    console.log(formatLog("FEATURE", `${flagName}: ${state ? "ON" : "OFF"}`, meta)),
};

export default logger;
