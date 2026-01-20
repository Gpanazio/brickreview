import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default to info
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'brickreview-server' },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
} else {
  // In production, we might want to log to console in JSON format for aggregation tools,
  // but typically we want to avoid spam.
  // For this specific request "Clean up Console Logs for Production", we will ensure
  // we don't just dump text to stdout unless it's an error or we explicitly want to.

  // Keeping console transport for production for now but relying on level filtering
  // and JSON format which is standard for containerized apps.
  // The main cleanup will be replacing ad-hoc console.log in code with logger.info/debug
  logger.add(new winston.transports.Console({
    format: winston.format.json(),
  }));
}

export default logger;
