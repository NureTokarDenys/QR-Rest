import { useEffect, useState } from 'react';

/**
 * Reactive `navigator.onLine` with `online` / `offline` window events.
 *
 * `navigator.onLine` is sometimes a false-positive (the device reports online
 * when on a captive-portal network), but it's the only signal the platform
 * offers without sending probe requests, and it's good enough for the offline
 * banner + order queue logic.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline  = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
