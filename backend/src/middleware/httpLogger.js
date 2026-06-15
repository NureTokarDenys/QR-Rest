const logger = require('../config/logger');

module.exports = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('http_request', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTimeMs: duration,
      userId: req.user?._id,
      request_id: req.requestId,
    });
  });

  next();
};
