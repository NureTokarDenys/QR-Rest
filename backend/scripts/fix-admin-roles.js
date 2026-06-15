/**
 * One-time repair: restore root_admin roles for seeded restaurant admins.
 * Usage:  node scripts/fix-admin-roles.js
 *
 * Safe to run multiple times — only updates records that are wrong.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const EXPECTED = [
  { email: 'admin@borshchechok.ua', role: 'root_admin' },
  { email: 'admin@premium.ua',      role: 'root_admin' },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  await mongoose.connect(uri);
  console.log('Connected.\n');

  for (const { email, role } of EXPECTED) {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`  NOT FOUND  ${email}`);
      continue;
    }
    if (user.role === role) {
      console.log(`  OK         ${email}  (already ${role})`);
      continue;
    }
    const oldRole = user.role;
    user.role = role;
    await user.save();
    console.log(`  FIXED      ${email}  ${oldRole} → ${role}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
