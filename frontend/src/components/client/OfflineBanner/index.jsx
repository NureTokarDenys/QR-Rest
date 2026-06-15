import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCloudOff, MdCloudDone } from 'react-icons/md';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { queueLength } from '../../../utils/offlineOrderQueue';
import styles from './offlineBanner.module.css';

/**
 * Floating banner at the top of every client page.
 *
 * - When `navigator.onLine === false`, shows a persistent "No connection" pill.
 * - When the connection comes back AND there are queued orders, shows a brief
 *   "Sending queued order…" pill for 4s, then auto-hides.
 *
 * The actual queue flush lives in AppContext; this component only displays.
 */
export default function OfflineBanner() {
  const { t }   = useTranslation('clientToast');
  const online  = useOnlineStatus();
  const [showReconnect, setShowReconnect] = useState(false);
  const [wasOffline, setWasOffline]       = useState(!online);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowReconnect(false);
      return;
    }
    if (wasOffline && queueLength() > 0) {
      setShowReconnect(true);
      const t = setTimeout(() => setShowReconnect(false), 4000);
      return () => clearTimeout(t);
    }
    setWasOffline(false);
  }, [online, wasOffline]);

  if (online && !showReconnect) return null;

  const offlineMsg   = t('offline_banner', { defaultValue: 'Немає з\'єднання — деякі функції недоступні' });
  const reconnectMsg = t('offline_flushing', { defaultValue: 'Замовлення відправляється…' });

  return (
    <div className={`${styles.banner} ${online ? styles.online : styles.offline}`} role="status" aria-live="polite">
      {online ? <MdCloudDone /> : <MdCloudOff />}
      <span>{online ? reconnectMsg : offlineMsg}</span>
    </div>
  );
}
