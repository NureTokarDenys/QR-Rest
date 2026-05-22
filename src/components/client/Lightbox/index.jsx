import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import styles from './lightbox.module.css';

/**
 * Full-screen image viewer used by client pages when the user taps a photo.
 *
 * - Renders into <body> via a portal so it always covers the whole viewport.
 * - Swipe (touch) + arrow buttons + keyboard (← / → / Esc) navigation.
 * - Infinite-loop carousel: virtual strip is [last, …images…, first]; after a
 *   transition into a clone finishes we silently jump to the real index, which
 *   keeps the slide direction natural at the edges.
 * - Body scroll is locked while open.
 *
 * Props
 *   images:        string[] — image URLs
 *   initialIndex:  number   — start position
 *   open:          boolean  — render the overlay or not
 *   onClose:       () => void
 *   alt:           string   — accessible label for the active image
 */
export default function Lightbox({ images = [], initialIndex = 0, open, onClose, alt = '' }) {
  const N = images.length;
  const hasMany = N > 1;

  // Virtual strip index:
  //   0           → clone of last (used only during the wrap animation)
  //   1..N        → real images
  //   N+1         → clone of first (wrap animation)
  // When N <= 1 we just keep index 0 and skip the cloning logic.
  const [trackIdx, setTrackIdx] = useState(() => (hasMany ? initialIndex + 1 : 0));
  const [isAnimated, setIsAnimated] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

  const containerRef = useRef(null);
  const touchStartX  = useRef(null);
  const transiting   = useRef(false);
  const transitTimer = useRef(null);

  // Reset position whenever the lightbox is (re-)opened
  useEffect(() => {
    if (!open) return;
    setIsAnimated(false);
    setTrackIdx(hasMany ? initialIndex + 1 : 0);
    // Re-enable transitions on the next frame so the jump is silent
    const t = setTimeout(() => setIsAnimated(true), 16);
    return () => clearTimeout(t);
  }, [open, initialIndex, hasMany]);

  // Lock body scroll while the lightbox is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const lockTransition = useCallback(() => {
    if (transiting.current) return false;
    transiting.current = true;
    clearTimeout(transitTimer.current);
    transitTimer.current = setTimeout(() => { transiting.current = false; }, 400);
    return true;
  }, []);

  const go = useCallback((dir) => {
    if (!hasMany) return;
    if (!lockTransition()) return;
    setIsAnimated(true);
    setTrackIdx(i => i + dir);
  }, [hasMany, lockTransition]);

  // Silent jump after the animation into a clone settles
  useEffect(() => {
    if (!open || !hasMany) return;
    if (trackIdx !== N + 1 && trackIdx !== 0) return;
    const t = setTimeout(() => {
      setIsAnimated(false);
      setTrackIdx(trackIdx === N + 1 ? 1 : N);
    }, 340);
    return () => clearTimeout(t);
  }, [trackIdx, hasMany, N, open]);

  // Re-enable animation on the frame after a silent jump
  useEffect(() => {
    if (isAnimated) return;
    const t = setTimeout(() => setIsAnimated(true), 16);
    return () => clearTimeout(t);
  }, [isAnimated]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape')      onClose?.();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft')  go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go, onClose]);

  if (!open || N === 0) return null;

  const strip = hasMany ? [images[N - 1], ...images, images[0]] : images;
  const realIdx = hasMany ? (trackIdx - 1 + N) % N : 0;

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <button
        className={styles.closeBtn}
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        aria-label="Close"
      >
        <MdClose />
      </button>

      {hasMany && (
        <div className={styles.counter}>{realIdx + 1} / {N}</div>
      )}

      <div
        ref={containerRef}
        className={styles.stage}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          if (!hasMany || transiting.current) return;
          touchStartX.current = e.touches[0].clientX;
          setDragging(true);
          setDragX(0);
        }}
        onTouchMove={(e) => {
          if (touchStartX.current === null) return;
          setDragX(e.touches[0].clientX - touchStartX.current);
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const threshold = (containerRef.current?.offsetWidth ?? 300) * 0.18;
          touchStartX.current = null;
          setDragging(false);
          setDragX(0);
          if (Math.abs(dx) >= threshold) go(dx < 0 ? 1 : -1);
        }}
      >
        <div
          className={styles.track}
          style={{
            transform: `translateX(calc(-${trackIdx * 100}% + ${dragX}px))`,
            transition: (dragging || !isAnimated)
              ? 'none'
              : 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {strip.map((url, i) => (
            <div key={i} className={styles.slide}>
              <img
                src={url}
                alt={i === trackIdx ? alt : ''}
                className={styles.image}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {hasMany && (
        <>
          <button
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            aria-label="Previous"
          >
            <MdChevronLeft />
          </button>
          <button
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={(e) => { e.stopPropagation(); go(1); }}
            aria-label="Next"
          >
            <MdChevronRight />
          </button>

          <div className={styles.dots} onClick={(e) => e.stopPropagation()}>
            {images.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === realIdx ? styles.dotActive : ''}`}
                onClick={() => {
                  if (!lockTransition()) return;
                  setIsAnimated(true);
                  setTrackIdx(i + 1);
                }}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
