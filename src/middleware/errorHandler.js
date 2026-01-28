const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const handleSequelizeError = (err) => {
  if (err.name === 'SequelizeUniqueConstraintError') {
    return new AppError('Duplicate field value entered', 400);
  }
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(e => e.message).join(', ');
    return new AppError(message, 400);
  }
  if (err.name === 'SequelizeDatabaseError') {
    return new AppError('Database Error', 500);
  }
  return err;
};

const sendErrorDev = (err, res) => {
  logger.error('DEV ERROR', err);
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak details
    logger.error('PROD ERROR', err);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Pass raw err to handler to check prototype/name properties correctly 
    // because spread operator might lose prototype chain depending on implementation
    if (err.name && err.name.startsWith('Sequelize')) {
      error = handleSequelizeError(err);
    }

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;