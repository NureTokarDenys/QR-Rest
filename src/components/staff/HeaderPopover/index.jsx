import React, { useState, useRef, useEffect } from 'react';
import styles from './headerPopover.module.css';

/**
 * Compact header-action popover used by narrow-viewport headers (Analytics
 * period picker, Cooking view toggle, Menu management add-action menu). The
 * trigger is rendered inline; visibility of the popover vs. the original
 * inline controls is controlled by each page's media queries — this component
 * just owns the open/close + click-outside behaviour.
 */
export default function HeaderPopover({ trigger, children, className = '', menuClassName = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div className={`${styles.menu} ${menuClassName}`} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
