/**
 * Database backup script.
 * Usage:  node scripts/db-backup.js [label]
 *
 * Creates  backups/<timestamp>[-label]/  and writes one JSON file per collection.
 * Uses EJSON so ObjectIds, Dates, etc. round-trip perfectly.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const fs   = require('fs');
const path = require('path');

const COLLECTIONS = [
  'restaurants', 'users', 'tables', 'sessions',
  'categories', 'menuitems', 'ingredients', 'addons',
  'componentgroups', 'componentoptions',
  'orders', 'orderitems', 'servinggroups',
  'payments', 'auditlogs', 'waitercalls',
  'restaurantreviews', 'dishreviews', 'tokenblacklists',
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);

  const label     = process.argv[2] ? `-${process.argv[2]}` : '';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dirName   = `${timestamp}${label}`;
  const dir       = path.join(__dirname, '..', 'backups', dirName);
  fs.mkdirSync(dir, { recursive: true });

  const db = mongoose.connection.db;
  let totalDocs = 0;

  console.log(`\nBacking up to  backups/${dirName}/`);
  console.log('─'.repeat(45));

  for (const name of COLLECTIONS) {
    try {
      const docs = await db.collection(name).find({}).toArray();
      const json = EJSON.stringify(docs, null, 2);
      fs.writeFileSync(path.join(dir, `${name}.json`), json, 'utf8');
      console.log(`  ✓  %-22s %d docs`.replace('%s', name).replace('%d', docs.length));
      totalDocs += docs.length;
    } catch (err) {
      console.log(`  –  ${name}: skipped (${err.message})`);
    }
  }

  // Write a manifest
  const manifest = {
    createdAt: new Date().toISOString(),
    label: process.argv[2] || null,
    mongoUri: uri.replace(/:\/\/[^@]+@/, '://***@'), // redact credentials
    collections: COLLECTIONS,
    totalDocs,
  };
  fs.writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('─'.repeat(45));
  console.log(`Total: ${totalDocs} documents`);
  console.log(`\n✅  Backup complete: backups/${dirName}/`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌  Backup failed:', err.message);
  process.exit(1);
});
