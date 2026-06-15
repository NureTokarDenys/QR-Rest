import React from 'react';
import { MdWifiOff, MdSync } from 'react-icons/md';
import styles from './wsStatusBanner.module.css';

/**
 * Shows a non-intrusive banner at the top of the page reflecting the current
 * WebSocket connection state.
 *
 * Only renders for 'reconnecting' and 'failed' statuses; invisible otherwise.
 *
 * @param {{ status: string }} props
 *   status — value returned by useWebSocket()
 */
export default function WsStatusBanner({ status }) {
  if (status !== 'reconnecting' && status !== 'failed') return null;

  const isFailed = status === 'failed';

  return (
    <div className={`${styles.banner} ${isFailed ? styles.failed : styles.reconnecting}`}>
      {isFailed ? (
        <>
          <MdWifiOff className={styles.icon} />
          <span>З'єднання втрачено. Спробуйте оновити сторінку.</span>
          <button className={styles.reloadBtn} onClick={() => window.location.reload()}>
            Оновити
          </button>
        </>
      ) : (
        <>
          <MdSync className={`${styles.icon} ${styles.spin}`} />
          <span>Відновлення з'єднання…</span>
        </>
      )}
    </div>
  );
}
