const logger = require('../config/logger');
const multer = require('multer');

module.exports = (err, req, res, next) => {
  logger.error('unhandled_error', {
    message: err.message,
    stack: err.stack,
    request_id: req.requestId,
    path: req.path,
    method: req.method,
  });

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
    return res.status(400).json({
      error: { code: 'FILE_ERROR', message },
      meta: { request_id: req.requestId },
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: err.message },
      meta: { request_id: req.requestId },
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Invalid resource ID' },
      meta: { request_id: req.requestId },
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: { code: 'DUPLICATE_KEY', message: 'Resource already exists' },
      meta: { request_id: req.requestId },
    });
  }

  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  res.status(status).json({
    error: { code: err.code || 'INTERNAL_ERROR', message },
    meta: { request_id: req.requestId },
  });
};
