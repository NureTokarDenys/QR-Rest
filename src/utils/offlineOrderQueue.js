/**
 * Offline order queue.
 *
 * When the guest taps "Confirm" without network we stash the createOrder
 * payload in localStorage and resolve immediately with a synthetic placeholder.
 * On reconnect, AppContext flushes the queue in arrival order — one POST at a
 * time so the server never sees duplicates for the same table.
 *
 * The queue survives a browser close/reopen by virtue of being in localStorage.
 *
 * Shape per entry: {
 *   id:          string,     // local UUID for de-dupe + UI
 *   restaurantId: string,
 *   payload:     CreateOrderPayload,
 *   queuedAt:    ISO date,
 * }
 */
const KEY = 'pendingOrderQueue';

export function readQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    if (!items.length) localStorage.removeItem(KEY);
    else               localStorage.setItem(KEY, JSON.stringify(items));
  } catch { /* quota / disabled — fail silently */ }
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueueOrder({ restaurantId, payload }) {
  const items = readQueue();
  const entry = { id: uuid(), restaurantId, payload, queuedAt: new Date().toISOString() };
  items.push(entry);
  writeQueue(items);
  return entry;
}

export function dequeueOrder(id) {
  const items = readQueue().filter(i => i.id !== id);
  writeQueue(items);
}

export function clearQueue() {
  writeQueue([]);
}

export function queueLength() {
  return readQueue().length;
}
