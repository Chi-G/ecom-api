const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  console.error('Error Details:', err);

  // sequelize Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(e => e.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // sequelize Database Error (General)
  if (err.name === 'SequelizeDatabaseError') {
    const message = 'Database Error';
    error = { message, statusCode: 500 };
  }

  res.status(error.statusCode).json({
    success: false,
    error: error.message || 'Server Error',
  });
};

module.exports = errorHandler;