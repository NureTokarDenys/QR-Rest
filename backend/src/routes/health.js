const router = require('express').Router();
const mongoose = require('mongoose');
const axios = require('axios');

router.get('/', async (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'ok' : 'error';

  let liqpay = 'unknown';
  if (process.env.NODE_ENV !== 'test') {
    try {
      await axios.get('https://www.liqpay.ua', { timeout: 3000 });
      liqpay = 'ok';
    } catch {
      liqpay = 'error';
    }
  }

  const status = db === 'ok' ? 200 : 503;
  res.status(status).json({
    data: { db, liqpay, uptime: process.uptime() },
    meta: { request_id: req.requestId },
  });
});

module.exports = router;
