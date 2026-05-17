import { useEffect, useRef, useCallback, useState } from 'react';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const PING_INTERVAL_MS = 25000;

/**
 * Derives the WebSocket URL.
 *
 * Priority:
 *  1. VITE_WS_URL env var — explicit override (e.g. "wss://api.example.com/ws")
 *  2. VITE_API_URL starts with http(s):// — strip path, swap protocol
 *     "http://host:5000/api"  →  "ws://host:5000/ws"
 *  3. Fallback — same origin as the page (works in dev via Vite WS proxy on /ws,
 *     and in production when API + frontend share a host)
 */
function buildWsUrl() {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) return wsUrl;

  const apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/^http(s?):\/\/([^/]*).*$/, (_, s, host) => `ws${s}://${host}/ws`);
  }

  // Same-origin: in dev Vite proxies /ws → backend; in prod they share a host
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

/**
 * Resilient WebSocket hook.
 *
 * Reads auth tokens from localStorage at connection time so reconnects after
 * a token refresh always use the latest credential.
 *
 * Reconnection strategy (per spec §7.5):
 *   - Retry every 3 s, up to 5 attempts
 *   - After 5 failures → status 'failed' (caller shows "connection lost" banner)
 *   - On reconnect → sends REPLAY_REQUEST with last received event_id
 *   - Sends PING every 25 s to keep the connection alive through idle timeouts
 *
 * @param {{ onMessage: (msg: object) => void, enabled?: boolean }} options
 * @returns {{ status: string, subscribe: (room: string) => void }}
 *   status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
 */
export function useWebSocket({ onMessage, enabled = true }) {
  const [status, setStatus] = useState('idle');
  const [latency, setLatency] = useState(null);

  const wsRef             = useRef(null);
  const mountedRef        = useRef(false);
  const retriesRef        = useRef(0);
  const retryTimerRef     = useRef(null);
  const pingTimerRef      = useRef(null);
  const pingTimestampRef  = useRef(null);
  const lastEventIdRef    = useRef(null);
  const roomsRef          = useRef(new Set());
  const onMessageRef      = useRef(onMessage);

  // Keep handler ref fresh without recreating connect
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  // ── connect ────────────────────────────────────────────────────────────────
  // Defined with no deps so it's stable; reads tokens fresh from localStorage
  // on every call so a token refresh is automatically picked up on reconnect.
  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token        = localStorage.getItem('accessToken');
    const sessionToken = localStorage.getItem('sessionToken');
    if (!token && !sessionToken) return;

    const params = new URLSearchParams();
    if (token)        params.set('token', token);
    if (sessionToken) params.set('session_token', sessionToken);

    const url = `${buildWsUrl()}?${params}`;
    setStatus(retriesRef.current > 0 ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }

      retriesRef.current = 0;
      setStatus('connected');

      // Re-subscribe to any rooms registered before this (re)connect
      roomsRef.current.forEach(room => {
        ws.send(JSON.stringify({ event: 'SUBSCRIBE', payload: { room } }));
      });

      // Replay events missed during the disconnect window (spec §7.5)
      if (lastEventIdRef.current) {
        ws.send(JSON.stringify({
          event: 'REPLAY_REQUEST',
          payload: { last_event_id: lastEventIdRef.current },
        }));
      }

      // Keepalive ping — prevents intermediate proxies from closing idle sockets
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingTimestampRef.current = Date.now();
          ws.send(JSON.stringify({ event: 'PING' }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        // Track the latest event_id for replay on reconnect
        if (msg.event_id) lastEventIdRef.current = msg.event_id;
        if (msg.event === 'PONG') {
          if (pingTimestampRef.current !== null) {
            setLatency(Date.now() - pingTimestampRef.current);
            pingTimestampRef.current = null;
          }
          return;
        }
        onMessageRef.current?.(msg);
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      clearInterval(pingTimerRef.current);
      if (!mountedRef.current) return;

      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1;
        setStatus('reconnecting');
        retryTimerRef.current = setTimeout(connect, RETRY_DELAY_MS);
      } else {
        setStatus('failed');
      }
    };

    // onerror always fires before onclose; let onclose drive retry logic
    ws.onerror = () => ws.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    mountedRef.current  = true;
    retriesRef.current  = 0;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      clearInterval(pingTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent retry on intentional unmount close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  // ── subscribe ──────────────────────────────────────────────────────────────
  // Registers a room so it is (re-)joined on every reconnect.
  const subscribe = useCallback((room) => {
    roomsRef.current.add(room);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'SUBSCRIBE', payload: { room } }));
    }
  }, []);

  return { status, subscribe, latency };
}
