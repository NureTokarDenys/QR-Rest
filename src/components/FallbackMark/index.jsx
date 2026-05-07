/**
 * FallbackMark — inline "*" indicator shown next to content that is being
 * displayed in the source language because no translation was set.
 *
 * Behaviour:
 *   Desktop  — tooltip appears on :hover (pure CSS, no JS)
 *   Mobile   — tooltip toggles on tap; propagation is stopped so the parent
 *               card / button does not fire its own onClick
 *
 * Usage:
 *   const fb = useFallbackField();
 *   const { value, isFallback } = fb(dish, 'name');
 *   <h1>{value}{isFallback && <FallbackMark tip={t('menu:fallback_tooltip')} />}</h1>
 */

import React, { useState, useCallback } from 'react';
import styles from './fallbackMark.module.css';

export default function FallbackMark({ tip }) {
  const [visible, setVisible] = useState(false);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setVisible(v => !v);
  }, []);

  // Hide on outside click
  const handleBlur = useCallback(() => setVisible(false), []);

  return (
    <span
      className={styles.wrap}
      aria-label={tip}
      tabIndex={0}
      onBlur={handleBlur}
    >
      {/* The asterisk — also the hover-trigger on desktop */}
      <span
        className={styles.mark}
        data-tip={tip}
        onClick={handleClick}
        aria-hidden="true"
      >
        *
      </span>

      {/* Mobile popover — shown when state is true */}
      {visible && (
        <span className={styles.popover} role="tooltip">
          {tip}
        </span>
      )}
    </span>
  );
}
