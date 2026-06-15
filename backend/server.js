require('dotenv').config();
require('dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config/database');
const { initWebSocket } = require('./src/websocket/wsServer');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  initWebSocket(server);

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  // Downgrade cancelled subscriptions whose end date has passed (check every minute).
  const Restaurant = require('./src/models/Restaurant');
  const wsService  = require('./src/services/wsService');
  setInterval(async () => {
    try {
      const expired = await Restaurant.find({
        plan: 'premium',
        subscriptionCancelled: true,
        subscriptionEndDate: { $lt: new Date() },
      }).select('_id').lean();

      for (const r of expired) {
        await Restaurant.findByIdAndUpdate(r._id, {
          $set:   { plan: 'free', subscriptionCancelled: false },
          $unset: { subscriptionStartDate: '', subscriptionEndDate: '' },
        });
        wsService.emit(`restaurant:${r._id}`, 'RESTAURANT_UPDATED', { plan: 'free' });
        logger.info('subscription_expired_downgraded', { restaurantId: r._id });
      }
    } catch (err) {
      logger.error('subscription_expiry_check_error', { error: err.message });
    }
  }, 60_000);

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    server.close(() => process.exit(0));
  });
}

start().catch((err) => {
  logger.error('Startup error', { error: err.message });
  process.exit(1);
});
