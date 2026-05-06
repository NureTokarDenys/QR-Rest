import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './confirmDialog.module.css';

/**
 * Reusable confirmation dialog.
 *
 * Props:
 *   open          — whether the dialog is visible
 *   title         — heading text
 *   message       — body text (optional)
 *   confirmLabel  — text on the confirm button  (default "Confirm")
 *   cancelLabel   — text on the cancel button   (default "Cancel")
 *   onConfirm     — called when user confirms
 *   onCancel      — called when user cancels (backdrop click, Escape, or Cancel button)
 *   danger        — makes the confirm button red  (default true)
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  onConfirm,
  onCancel,
  danger = true,
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className={styles.dialog}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>{title}</h2>
        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${danger ? styles.btnDanger : styles.btnPrimary}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
