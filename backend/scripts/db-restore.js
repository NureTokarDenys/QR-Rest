/**
 * Database restore script.
 * Usage:
 *   node scripts/db-restore.js              — list available backups
 *   node scripts/db-restore.js <name>        — restore that backup (e.g. 2026-05-03T12-00-00)
 *   node scripts/db-restore.js <name> --dry  — preview without writing
 *
 * Drops every collection in the backup, then re-inserts from the saved JSON.
 * EJSON is used so ObjectIds, Dates, etc. are restored exactly.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const fs   = require('fs');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// ─── list ──────────────────────────────────────────────────────────────────

function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('No backups directory found. Run  npm run db:backup  first.');
    return;
  }
  const entries = fs.readdirSync(BACKUPS_DIR)
    .filter((e) => fs.statSync(path.join(BACKUPS_DIR, e)).isDirectory())
    .sort()
    .reverse();

  if (!entries.length) {
    console.log('No backups found in backups/');
    return;
  }

  console.log('Available backups:\n');
  for (const name of entries) {
    const manifestPath = path.join(BACKUPS_DIR, name, '_manifest.json');
    let info = '';
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      info = `  ${m.totalDocs} docs  ${m.label ? `[${m.label}]` : ''}`;
    }
    console.log(`  ${name}${info}`);
  }
  console.log(`\nUsage: node scripts/db-restore.js <name>`);
}

// ─── restore ───────────────────────────────────────────────────────────────

async function restore(backupName, dry) {
  const dir = path.join(BACKUPS_DIR, backupName);
  if (!fs.existsSync(dir)) {
    throw new Error(`Backup not found: backups/${backupName}`);
  }

  const manifestPath = path.join(dir, '_manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null;

  console.log(`Restoring from: backups/${backupName}/`);
  if (manifest) {
    console.log(`  Created at : ${manifest.createdAt}`);
    console.log(`  Label      : ${manifest.label ?? '—'}`);
    console.log(`  Total docs : ${manifest.totalDocs}`);
  }
  if (dry) console.log('\n  [DRY RUN — no data will be written]\n');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  if (!dry) {
    console.log('\nConnecting to MongoDB…');
    await mongoose.connect(uri);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json');
  console.log('\n' + '─'.repeat(50));

  let totalRestored = 0;

  for (const file of files.sort()) {
    const collectionName = path.basename(file, '.json');
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const docs = EJSON.parse(raw);

    if (!docs.length) {
      console.log(`  –  ${collectionName}: empty, skipped`);
      continue;
    }

    if (dry) {
      console.log(`  ○  ${collectionName}: would restore ${docs.length} docs`);
      totalRestored += docs.length;
      continue;
    }

    const col = mongoose.connection.db.collection(collectionName);
    await col.deleteMany({});          // native driver — bypasses mongoose hooks
    await col.insertMany(docs, { ordered: false });
    console.log(`  ✓  ${collectionName}: ${docs.length} docs restored`);
    totalRestored += docs.length;
  }

  console.log('─'.repeat(50));
  console.log(`Total: ${totalRestored} documents${dry ? ' (dry run)' : ' restored'}`);

  if (!dry) {
    console.log('\n✅  Restore complete.');
    await mongoose.disconnect();
  }
}

// ─── entry point ───────────────────────────────────────────────────────────

const [,, backupName, flag] = process.argv;

if (!backupName) {
  listBackups();
} else {
  restore(backupName, flag === '--dry').catch((err) => {
    console.error('\n❌  Restore failed:', err.message);
    process.exit(1);
  });
}
