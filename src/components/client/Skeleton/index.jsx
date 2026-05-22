import React from 'react';
import styles from './skeleton.module.css';

export function SkeletonBlock({ width, height, borderRadius, style, className }) {
  return (
    <div
      className={`${styles.block} ${className || ''}`}
      style={{ width, height, borderRadius, ...style }}
    />
  );
}

// 8 cards = 2 rows at 4-col desktop, 4 rows at 2-col mobile
const CARD_COUNT = 8;

export function MenuSkeleton() {
  return (
    <div className={styles.menuGrid}>
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <div key={i} className={`${styles.block} ${styles.categoryCard}`} />
      ))}
    </div>
  );
}

export function CategorySkeleton() {
  return (
    <>
      {/* mirrors the SearchBar height so layout doesn't jump */}
      <SkeletonBlock height={44} borderRadius={12} />
      <div className={styles.dishGrid}>
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div key={i} className={styles.dishCard}>
            <div className={`${styles.block} ${styles.dishCardImage}`} />
            <div className={styles.dishCardBody}>
              <SkeletonBlock height={13} borderRadius={6} />
              <SkeletonBlock height={12} width="65%" borderRadius={6} />
              <SkeletonBlock height={18} width="45%" borderRadius={6} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DishDetailSkeleton() {
  return (
    <div className={styles.dishDetailPage}>
      <div className={`${styles.block} ${styles.dishDetailImage}`} />
      <div className={styles.dishDetailBody}>
        <SkeletonBlock height={28} borderRadius={8} />
        <SkeletonBlock height={22} width="35%" borderRadius={8} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <SkeletonBlock height={13} borderRadius={6} />
          <SkeletonBlock height={13} borderRadius={6} />
          <SkeletonBlock height={13} width="75%" borderRadius={6} />
        </div>
        <SkeletonBlock height={44} borderRadius={12} style={{ marginTop: 8 }} />
      </div>
      <div className={styles.dishDetailFooter}>
        <SkeletonBlock height={48} borderRadius={14} />
      </div>
    </div>
  );
}
