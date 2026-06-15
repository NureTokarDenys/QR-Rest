const Notification = require('../models/Notification');
const { emit } = require('./wsService');

const STATUS_LABELS = {
  cooking: { uk: 'готується', en: 'is being cooked' },
  ready:   { uk: 'готова до подачі', en: 'is ready' },
  served:  { uk: 'подано', en: 'has been served' },
};

const STATUS_LABELS_FULL = {
  waiting: { uk: 'в черзі',          en: 'in queue'  },
  cooking: { uk: 'готується',        en: 'cooking'   },
  ready:   { uk: 'готово до подачі', en: 'ready'     },
  served:  { uk: 'подано',           en: 'served'    },
};

function buildMessage(type, data = {}) {
  switch (type) {
    case 'dish_status_updated': {
      const label = STATUS_LABELS[data.dishStatus] || { uk: data.dishStatus, en: data.dishStatus };
      const groupPart = data.groupName ? ` (${data.groupName})` : '';
      return {
        title_uk: `Страва${groupPart} ${label.uk}`,
        title_en: `Dish${groupPart} ${label.en}`,
        body_uk:  '',
        body_en:  '',
      };
    }
    case 'order_cancelled':
      return {
        title_uk: 'Замовлення скасовано',
        title_en: 'Order cancelled',
        body_uk:  data.reason || '',
        body_en:  data.reason || '',
      };
    case 'payment_completed_cash':
      return {
        title_uk: 'Запит на оплату готівкою відправлено',
        title_en: 'Cash payment request sent',
        body_uk:  'Офіціант підійде і прийме оплату готівкою',
        body_en:  'A waiter will come to collect your cash payment',
      };
    case 'payment_completed_epay':
      return {
        title_uk: 'Онлайн-оплату підтверджено',
        title_en: 'Online payment confirmed',
        body_uk:  data.amount ? `Сума: ${data.amount}₴` : '',
        body_en:  data.amount ? `Amount: ₴${data.amount}` : '',
      };
    case 'items_added':
      return {
        title_uk: 'Додано нові страви',
        title_en: 'New dishes added',
        body_uk:  data.count ? `${data.count} позицій до вашого замовлення` : '',
        body_en:  data.count ? `${data.count} item(s) added to your order` : '',
      };
    case 'dish_status_corrected': {
      const groupPart  = data.groupName ? ` (${data.groupName})` : '';
      const fromLbl    = STATUS_LABELS_FULL[data.fromStatus] || { uk: data.fromStatus, en: data.fromStatus };
      const toLbl      = STATUS_LABELS_FULL[data.toStatus]   || { uk: data.toStatus,   en: data.toStatus   };
      return {
        title_uk: `Статус групи виправлено`,
        title_en: `Group status corrected`,
        body_uk:  `Статус групи${groupPart} змінено з «${fromLbl.uk}» на «${toLbl.uk}» — помилкова зміна`,
        body_en:  `Group${groupPart} status changed from "${fromLbl.en}" to "${toLbl.en}" — accidental change`,
      };
    }
    default:
      return { title_uk: '', title_en: '', body_uk: '', body_en: '' };
  }
}

/**
 * Create a notification record and push it to the guest via WebSocket.
 *
 * @param {{ orderId, restaurantId, sessionToken, tableId?, type, data? }} params
 * @returns {Promise<object>} the saved Notification document
 */
async function createNotification({ orderId, restaurantId, sessionToken, tableId, type, data = {} }) {
  const msg = buildMessage(type, data);
  const notification = await Notification.create({
    orderId,
    restaurantId,
    sessionToken,
    type,
    ...msg,
    data,
  });

  const payload = {
    notification: {
      _id:      notification._id,
      orderId,
      type,
      title_uk: notification.title_uk,
      title_en: notification.title_en,
      body_uk:  notification.body_uk,
      body_en:  notification.body_en,
      data,
      readAt:   null,
      createdAt: notification.createdAt,
    },
  };

  // Emit to the session room (primary) and also to the table room so the client
  // receives the notification even if the session token was re-issued after the
  // order was created (e.g. QR code re-scanned).
  emit(`session:${sessionToken}`, 'NOTIFICATION_NEW', payload);
  if (tableId) emit(`table:${tableId}`, 'NOTIFICATION_NEW', payload);

  return notification;
}

module.exports = { createNotification };
