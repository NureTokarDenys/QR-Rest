import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Thin wrapper around the single global WebSocket owned by AppContext.
 *
 * Previously each page opened its own socket — for a staff user navigating
 * around the app that meant 4–6 parallel connections to the same server.
 * Now every consumer simply registers a listener on the shared connection,
 * so the entire staff app uses ONE socket.
 *
 * Interface preserved for backward compatibility:
 *   const { status, latency, subscribe } = useWebSocket({ onMessage, enabled });
 */
export function useWebSocket({ onMessage, enabled = true }) {
  const { wsStatus, wsLatency, wsSubscribe, addWsListener, removeWsListener } = useApp();
  const handlerRef = useRef(onMessage);

  // Keep the latest handler reference without re-subscribing every render.
  useEffect(() => { handlerRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    const fn = (msg) => handlerRef.current?.(msg);
    addWsListener(fn);
    return () => removeWsListener(fn);
  }, [enabled, addWsListener, removeWsListener]);

  return { status: wsStatus, latency: wsLatency, subscribe: wsSubscribe };
}
