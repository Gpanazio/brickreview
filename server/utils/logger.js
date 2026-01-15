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

const formatLog = (tag, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  // Serializa meta se existir para garantir que apareça no log de texto
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `[${tag}] ${timestamp} ${message}${metaStr}`;
};

export const logger = {
  error: (tag, message, meta) => console.error(formatLog(tag, message, meta)),
  warn: (tag, message, meta) => console.warn(formatLog(tag, message, meta)),
  info: (tag, message, meta) => console.log(formatLog(tag, message, meta)),
  debug: (tag, message, meta) => {
    if (process.env.NODE_ENV !== "production") console.log(formatLog(tag, message, meta));
  },
  metric: (name, value, meta = {}) => console.log(formatLog("METRIC", `${name}: ${value}`, meta)),
  feature: (flagName, state, meta = {}) =>
    console.log(formatLog("FEATURE", `${flagName}: ${state ? "ON" : "OFF"}`, meta)),
};

export default logger;
