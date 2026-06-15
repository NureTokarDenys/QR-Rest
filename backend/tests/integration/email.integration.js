/**
 * tests/integration/email.integration.js
 *
 * Real Resend integration test — run manually:
 *   node tests/integration/email.integration.js [recipient@example.com]
 *
 * Reads RESEND_API_KEY and EMAIL_FROM from .env.
 * Sends actual emails and prints the Resend message IDs.
 *
 * The optional CLI argument sets the recipient address.
 * Defaults to the SMTP_USER / test@resend.dev fallback.
 */

'use strict';

require('dotenv').config();

const React                  = require('react');
const { Resend }             = require('resend');
const { render }             = require('@react-email/render');
const OnboardingConfirmation = require('../../emails/OnboardingConfirmation');
const OnboardingCredentials  = require('../../emails/OnboardingCredentials');

// ─── config ──────────────────────────────────────────────────────────────────

const API_KEY   = process.env.RESEND_API_KEY;
const FROM      = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const TO        = process.argv[2] || 'delivered@resend.dev'; // resend's own sink address
const BASE_URL  = process.env.BASE_URL || 'http://localhost:5000';
const LOGIN_URL = 'http://localhost:3000/login';

if (!API_KEY || API_KEY.startsWith('re_your')) {
  console.error('❌  RESEND_API_KEY is not set in .env');
  process.exit(1);
}

const resend = new Resend(API_KEY);

// ─── fixtures ────────────────────────────────────────────────────────────────

const OWNER_NAME      = 'Іван Франко';
const RESTAURANT_NAME = 'Тестовий Борщечок';
const RESTAURANT_ID   = 'TST00001';
const CONFIRM_URL     = `${BASE_URL}/api/onboarding/confirm/integration-test-token-abc123`;
const PASSWORD        = 'IntTest!Pass9';

// ─── helpers ─────────────────────────────────────────────────────────────────

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(` ${title}`);
  console.log('─'.repeat(60));
}

async function sendAndReport(label, payload) {
  process.stdout.write(`Sending ${label}… `);
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.log('FAILED');
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
  console.log(`OK  (id: ${data.id})`);
  return data.id;
}

// ─── tests ───────────────────────────────────────────────────────────────────

async function testConfirmationEmail() {
  section('1 / 2  —  OnboardingConfirmation');

  // Preview rendered HTML size
  const html = await render(
    React.createElement(OnboardingConfirmation, {
      ownerName: OWNER_NAME, restaurantName: RESTAURANT_NAME, confirmUrl: CONFIRM_URL,
    })
  );
  console.log(`Template size: ${html.length} chars`);

  const id = await sendAndReport('OnboardingConfirmation', {
    from:    FROM,
    to:      TO,
    subject: `[Integration test] Підтвердіть реєстрацію «${RESTAURANT_NAME}»`,
    react:   React.createElement(OnboardingConfirmation, {
      ownerName:      OWNER_NAME,
      restaurantName: RESTAURANT_NAME,
      confirmUrl:     CONFIRM_URL,
    }),
  });

  return id;
}

async function testCredentialsEmail() {
  section('2 / 2  —  OnboardingCredentials');

  const html = await render(
    React.createElement(OnboardingCredentials, {
      ownerName: OWNER_NAME, restaurantName: RESTAURANT_NAME,
      restaurantId: RESTAURANT_ID, email: TO, password: PASSWORD, loginUrl: LOGIN_URL,
    })
  );
  console.log(`Template size: ${html.length} chars`);

  const id = await sendAndReport('OnboardingCredentials', {
    from:    FROM,
    to:      TO,
    subject: `[Integration test] Дані для входу — ${RESTAURANT_NAME}`,
    react:   React.createElement(OnboardingCredentials, {
      ownerName:      OWNER_NAME,
      restaurantName: RESTAURANT_NAME,
      restaurantId:   RESTAURANT_ID,
      email:          TO,
      password:       PASSWORD,
      loginUrl:       LOGIN_URL,
    }),
  });

  return id;
}

// ─── run ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🔌  Resend email integration test');
  console.log(`API key : ${API_KEY.slice(0, 10)}…`);
  console.log(`From    : ${FROM}`);
  console.log(`To      : ${TO}`);

  const id1 = await testConfirmationEmail();
  const id2 = await testCredentialsEmail();

  section('Results');
  console.log(`OnboardingConfirmation  →  ${id1}`);
  console.log(`OnboardingCredentials   →  ${id2}`);
  console.log('\n✅  All integration emails sent successfully.');
  console.log(`   Check your inbox at ${TO} or the Resend dashboard.\n`);
}

run().catch((err) => {
  console.error('\n❌  Email integration test failed:', err.message);
  process.exit(1);
});
