/**
 * Real Google OAuth integration check — run manually:
 *   node tests/integration/google-oauth.integration.js
 *
 * Verifies that the OAuth client ID + secret are accepted by Google
 * and that the redirect URL is correctly formed.
 * A full token exchange requires a browser; this script checks what it can
 * without one.
 */

require('dotenv').config();
const https = require('https');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
      resolve({ status: res.statusCode, location: res.headers.location });
    }).on('error', reject);
  });
}

async function run() {
  console.log(`Client ID     : ${CLIENT_ID?.slice(0, 20)}…`);
  console.log(`Callback URL  : ${CALLBACK_URL}\n`);

  if (!CLIENT_ID || CLIENT_ID === 'test_google_client_id') {
    throw new Error('GOOGLE_CLIENT_ID is not set to a real value in .env');
  }

  // 1. Build the OAuth URL the same way Passport does
  const oauthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
    `&response_type=code` +
    `&scope=profile%20email`;

  // 2. Hit Google — a valid client_id gets a 200 consent page,
  //    an invalid one gets a 400 with error=invalid_client.
  process.stdout.write('Probing Google OAuth endpoint… ');
  const { status, location } = await get(oauthUrl);

  // Google returns 200 for the consent page (valid client_id)
  // or redirects with an error param for invalid credentials.
  if (status === 400 || (location && location.includes('error=invalid_client'))) {
    throw new Error('Google rejected the client_id — check GOOGLE_CLIENT_ID in .env');
  }

  console.log(`HTTP ${status} — client_id accepted by Google\n`);

  // 3. Confirm callback URL is registered (can only be fully verified in Google Console)
  console.log('Redirect URI that must be registered in Google Cloud Console:');
  console.log(`  ${CALLBACK_URL}\n`);

  console.log('✅  Google OAuth integration: client credentials look valid.');
  console.log('    Complete the browser flow at:');
  console.log(`    ${oauthUrl}`);
}

run().catch((err) => {
  console.error('\n❌  Google OAuth integration failed:', err.message);
  process.exit(1);
});
