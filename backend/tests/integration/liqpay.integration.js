/**
 * Real LiqPay integration check — run manually:
 *   node tests/integration/liqpay.integration.js
 *
 * Reads credentials from .env (LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY).
 * Does NOT create a real charge — uses LiqPay's sandbox action "pay" with
 * sandbox=1 so it can be verified without actual money movement.
 *
 * Checks:
 *   1. Payload is correctly signed (signature round-trip)
 *   2. LiqPay's API accepts the signed request (HTTP 200, no auth error)
 *   3. Webhook signature verification works with the real private key
 */

require('dotenv').config();
const https = require('https');
const { createPayment, verifyWebhook, encodeData, sign } = require('../../src/services/liqpayService');

const PUBLIC_KEY  = process.env.LIQPAY_PUBLIC_KEY;
const PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY;

// ─── helpers ─────────────────────────────────────────────────────────────────

function post(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(body).toString();
    const req = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function assert(label, condition, detail = '') {
  if (!condition) throw new Error(`FAIL — ${label}${detail ? ': ' + detail : ''}`);
  console.log(`  ✓  ${label}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('LiqPay integration check');
  console.log('─'.repeat(50));
  console.log(`Public key  : ${PUBLIC_KEY?.slice(0, 12)}…`);
  console.log(`Private key : ${PRIVATE_KEY ? '***set***' : 'NOT SET'}`);
  console.log();

  if (!PUBLIC_KEY || PUBLIC_KEY === 'test_public_key') {
    throw new Error('LIQPAY_PUBLIC_KEY is not set to a real value in .env');
  }
  if (!PRIVATE_KEY || PRIVATE_KEY === 'test_private_key') {
    throw new Error('LIQPAY_PRIVATE_KEY is not set to a real value in .env');
  }

  // ── 1. Signature round-trip ────────────────────────────────────────────────
  console.log('1. Signature round-trip');
  const testOrderId = `integration-test-${Date.now()}`;
  const { data, signature } = await createPayment({
    orderId: testOrderId,
    amount: 1,
    description: 'Integration test (sandbox)',
    serverUrl: 'https://example.com/webhook',
  });

  assert('createPayment returns base64 data', typeof data === 'string' && data.length > 0);
  assert('createPayment returns base64 signature', typeof signature === 'string' && signature.length > 0);

  const recomputed = sign(data);
  assert('Signature matches recomputed value', recomputed === signature);

  // ── 2. Webhook signature verification ─────────────────────────────────────
  console.log('\n2. Webhook signature verification');
  const fakeWebhookData = encodeData({ status: 'success', order_id: testOrderId, transaction_id: 'tx-integration-001' });
  const fakeWebhookSig  = sign(fakeWebhookData);

  assert('verifyWebhook accepts valid signature',   verifyWebhook(fakeWebhookData, fakeWebhookSig));
  assert('verifyWebhook rejects tampered signature', !verifyWebhook(fakeWebhookData, 'tampered-sig'));
  assert('verifyWebhook rejects tampered data',      !verifyWebhook('tampered-data', fakeWebhookSig));

  // ── 3. LiqPay API reachability & key validation ───────────────────────────
  console.log('\n3. LiqPay API — key validation via sandbox request');

  const sandboxParams = {
    public_key: PUBLIC_KEY,
    version: '3',
    action: 'pay',
    amount: '1',
    currency: 'UAH',
    description: 'Integration test',
    order_id: testOrderId,
    sandbox: '1',
  };
  const sdData = encodeData(sandboxParams);
  const sdSig  = sign(sdData);

  const { status, body } = await post('www.liqpay.ua', '/api/request', { data: sdData, signature: sdSig });

  assert(`LiqPay API is reachable (HTTP ${status})`, status === 200, `got ${status}`);

  let parsed;
  try { parsed = JSON.parse(body); } catch { throw new Error(`Non-JSON response from LiqPay: ${body.slice(0, 200)}`); }

  // LiqPay returns status:"sandbox" for valid sandbox requests.
  // An auth error would return status:"error" with err_code like "public_key_not_found".
  const authFailed = parsed.err_code === 'public_key_not_found' || parsed.err_code === 'invalid_sign';
  assert(
    `LiqPay accepted the credentials (status: ${parsed.status})`,
    !authFailed,
    authFailed ? `err_code=${parsed.err_code}, err_description=${parsed.err_description}` : ''
  );

  console.log(`\n  Response: status=${parsed.status}, payment_id=${parsed.payment_id ?? 'n/a'}`);

  console.log('\n' + '─'.repeat(50));
  console.log('✅  LiqPay integration: all checks passed.');
  console.log('\nNote: the sandbox payment is not a real charge.');
  console.log('To test a full webhook round-trip, configure BASE_URL to a');
  console.log('publicly reachable server and check the /api/payments/webhook/liqpay logs.');
}

run().catch((err) => {
  console.error('\n❌  LiqPay integration failed:', err.message);
  process.exit(1);
});
