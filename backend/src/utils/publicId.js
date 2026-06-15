const crypto = require('crypto');

const ALPHABET    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ID_LENGTH   = 8;
const MAX_ATTEMPTS = 10;

/**
 * Generate a random unique 8-character alphanumeric ID (e.g. "K4X9B2MR").
 * The ID is intended to be used directly as the document's _id.
 *
 * Character set: A-Z + 0-9 → 36^8 ≈ 2.8 trillion possible values.
 *
 * @param {import('mongoose').Model} Model — model to check uniqueness against (via findById)
 * @returns {Promise<string>}
 */
async function nextPublicId(Model) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const bytes = crypto.randomBytes(ID_LENGTH);
    const id    = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');

    const exists = await Model.findById(id).lean();
    if (!exists) return id;
  }
  throw new Error(`nextPublicId: could not generate a unique id after ${MAX_ATTEMPTS} attempts`);
}

module.exports = { nextPublicId };
