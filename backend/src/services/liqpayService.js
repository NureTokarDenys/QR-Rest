const crypto = require('crypto');
const axios  = require('axios');

function encodeData(params) {
  return Buffer.from(JSON.stringify(params)).toString('base64');
}

// LiqPay signature: base64( sha1( private_key + data + private_key ) )
// Despite docs showing sha3-256, LiqPay actually validates with sha1 —
// sha3-256 produces an explicit invalid_signature error.
function sign(privateKey, data) {
  return crypto
    .createHash('sha1')
    .update(privateKey + data + privateKey)
    .digest('base64');
}

function decodeWebhookData(rawData) {
  return JSON.parse(Buffer.from(rawData, 'base64').toString('utf8'));
}

function createLiqpayService(publicKey, privateKey) {
  const isSandbox = publicKey?.startsWith('sandbox_');

  async function createPayment({ orderId, amount, description, currency = 'UAH', resultUrl, serverUrl, action = 'pay', extra = {} }) {
    const params = {
      public_key: publicKey,
      version:    3,
      action,
      amount,
      currency,
      description,
      language:   'uk',
      order_id:   orderId.toString(),
      ...(isSandbox && { sandbox: 1 }),
      ...(resultUrl && { result_url: resultUrl }),
      ...(serverUrl && { server_url: serverUrl }),
      ...extra,
    };
    const data      = encodeData(params);
    const signature = sign(privateKey, data);
    return { data, signature, publicKey };
  }

  function verifyWebhook(data, receivedSignature) {
    return sign(privateKey, data) === receivedSignature;
  }

  /**
   * Validate keys by calling LiqPay's status API with a non-existent order ID.
   * Valid keys   → LiqPay responds with err_code 'payment_not_found' (order unknown, but auth passed)
   * Invalid keys → LiqPay responds with err_code 'invalid_sign' / 'authorization failed'
   * Network err  → treat as valid so a temporary LiqPay outage doesn't block payments
   */
  async function validateKeys() {
    const testOrderId = `key_check_${Date.now()}`;
    const params = { public_key: publicKey, version: 3, action: 'status', order_id: testOrderId };
    const data      = encodeData(params);
    const signature = sign(privateKey, data);

    try {
      const res = await axios.post(
        'https://www.liqpay.ua/api/request',
        new URLSearchParams({ data, signature }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 },
      );
      const body = res.data;
      const INVALID_CODES = new Set(['invalid_sign', 'invalid_key', 'authorization_failed', 'authorization failed']);
      if (INVALID_CODES.has(body?.err_code) || body?.result === 'authorization failed') {
        return { valid: false, reason: 'invalid_credentials' };
      }
      // Any other error (payment_not_found, order_not_found, etc.) means keys are fine
      return { valid: true };
    } catch (_err) {
      // Network timeout or LiqPay outage — don't block the user
      return { valid: true, networkError: true };
    }
  }

  return { createPayment, verifyWebhook, validateKeys };
}

// Platform-level service (subscriptions)
function getPlatformService() {
  return createLiqpayService(
    process.env.LIQPAY_PUBLIC_KEY,
    process.env.LIQPAY_PRIVATE_KEY,
  );
}

module.exports = { createLiqpayService, encodeData, decodeWebhookData, getPlatformService, sign };
