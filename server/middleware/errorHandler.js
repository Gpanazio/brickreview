import logger from '../utils/logger.js';

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }
    // Programming or other unknown error: don't leak details
    else {
        // 1) Log error
        logger.error('ERROR', 'Unhandled exception', {
            message: err.message,
            stack: err.stack
        });

        // 2) Send generic message
        res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!',
        });
    }
};

export const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        // Copy properties that might not be enumerable
        let error = { ...err };
        error.message = err.message;
        error.statusCode = err.statusCode;
        error.isOperational = err.isOperational || false;

        sendErrorProd(error, res);
    }
};
