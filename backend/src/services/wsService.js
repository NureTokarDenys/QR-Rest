const { v4: uuidv4 } = require('uuid');

let wss = null;
const rooms = new Map(); // roomName -> Set of ws clients
const eventQueue = new Map(); // roomName -> [{event_id, event, payload, timestamp}]
const QUEUE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function setWss(server) {
  wss = server;
}

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  if (!ws.rooms) ws.rooms = new Set();
  ws.rooms.add(room);
}

function leaveAllRooms(ws) {
  if (!ws.rooms) return;
  ws.rooms.forEach((room) => {
    const set = rooms.get(room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(room);
    }
  });
}

function emit(room, event, payload) {
  const event_id = uuidv4();
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ event, payload, timestamp, event_id });

  // Store in queue for replay
  if (!eventQueue.has(room)) eventQueue.set(room, []);
  eventQueue.get(room).push({ event_id, event, payload, timestamp });

  // Prune old events
  const cutoff = Date.now() - QUEUE_TTL_MS;
  eventQueue.set(
    room,
    eventQueue.get(room).filter((e) => new Date(e.timestamp).getTime() > cutoff)
  );

  const clients = rooms.get(room);
  if (!clients) return;
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(message);
  });
}

function replayEvents(ws, room, lastEventId) {
  const queue = eventQueue.get(room) || [];
  if (!lastEventId) return;

  const idx = queue.findIndex((e) => e.event_id === lastEventId);
  const toReplay = idx >= 0 ? queue.slice(idx + 1) : [];

  toReplay.forEach((e) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ event: e.event, payload: e.payload, timestamp: e.timestamp, event_id: e.event_id }));
    }
  });
}

function __resetForTests__() {
  rooms.clear();
  eventQueue.clear();
}

module.exports = { setWss, joinRoom, leaveAllRooms, emit, replayEvents, __resetForTests__ };
