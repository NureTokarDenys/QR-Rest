/**
 * Real S3 integration check — run manually:
 *   node tests/integration/s3.integration.js
 *
 * Reads credentials from .env (not the test fake keys).
 * Uploads a small test image, verifies the URL is reachable, then deletes it.
 */

require('dotenv').config();
const { uploadImage, deleteImage, BUCKET } = require('../../src/config/aws');
const https = require('https');
const http = require('http');

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
  'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
  'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIhAAAgIB' +
  'BAMAAAAAAAAAAAAAAQIDBAUREiExQf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAA' +
  'AAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amk2ta1TlPqpqJyuSeT3JJJJJJJJJJJJJJJJJ' +
  'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ' +
  'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ',
  'base64'
);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => resolve(res.statusCode)).on('error', reject);
  });
}

async function run() {
  console.log(`Bucket : ${BUCKET}`);
  console.log(`Region : ${process.env.AWS_REGION}`);
  console.log(`Key ID : ${process.env.AWS_ACCESS_KEY_ID?.slice(0, 8)}…\n`);

  const key = `integration-test/probe-${Date.now()}.jpg`;

  // 1. Upload
  process.stdout.write('Uploading test image… ');
  const url = await uploadImage(TINY_JPEG, 'image/jpeg', key);
  console.log(`OK\nURL: ${url}\n`);

  // 2. Verify the uploaded file is publicly reachable
  process.stdout.write('Checking public URL… ');
  const status = await fetchUrl(url);
  if (status !== 200) throw new Error(`Expected HTTP 200, got ${status}`);
  console.log('OK (HTTP 200)\n');

  // 3. Delete
  process.stdout.write('Deleting test image… ');
  await deleteImage(key);
  console.log('OK\n');

  console.log('✅  S3 integration: all checks passed.');
}

run().catch((err) => {
  console.error('\n❌  S3 integration failed:', err.message);
  process.exit(1);
});
