import React from 'react';
import styles from './skeleton.module.css';

/**
 * Skel — a single pulsing placeholder block.
 * The colour cycles light-grey ⇄ dark-grey via the shared `skelPulse`
 * animation defined in skeleton.module.css.
 */
export function Skel({ w = '100%', h = 14, r = 8, className = '', style }) {
  return (
    <span
      className={`${styles.skel} ${className}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/* ── Variant: grid of cards (orders, menu, cooking) ── */
function CardsSkeleton({ count = 8 }) {
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <Skel w={170} h={20} />
        <Skel w={44} h={38} r={10} />
      </div>
      <div className={styles.grid}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardTop}>
              <Skel w={120} h={18} />
              <Skel w={66} h={22} r={6} />
            </div>
            <Skel w="100%" h={13} />
            <Skel w="85%" h={13} />
            <Skel w="55%" h={13} />
            <Skel w="100%" h={36} r={10} style={{ marginTop: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Variant: data table (staff management) ── */
function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <Skel w={150} h={20} />
        <Skel w={130} h={38} r={10} />
      </div>
      <div className={styles.tableWrap}>
        <div className={styles.tableHeadRow}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skel key={i} w={i === 0 ? 140 : 90} h={12} className={styles.tableCell} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className={styles.tableRow}>
            <div className={styles.userCell}>
              <Skel w={34} h={34} r="50%" />
              <Skel w={130} h={14} />
            </div>
            <Skel w={150} h={13} className={styles.tableCell} />
            <Skel w={90} h={28} r={8} className={styles.tableCell} />
            <Skel w={70} h={22} r={6} className={styles.tableCell} />
            <Skel w={80} h={28} r={8} className={styles.tableCellSmall} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Variant: vertical list (reviews, extras) ── */
function ListSkeleton({ rows = 6 }) {
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <Skel w={160} h={20} />
        <Skel w={120} h={36} r={10} />
      </div>
      <div className={styles.list}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.listItem}>
            <div className={styles.listItemTop}>
              <div className={styles.listItemLeft}>
                <Skel w={40} h={40} r="50%" />
                <Skel w={150} h={15} />
              </div>
              <Skel w={90} h={20} r={6} />
            </div>
            <Skel w="100%" h={12} />
            <Skel w="70%" h={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Variant: analytics dashboard ── */
function AnalyticsSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.kpiRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.kpiCard}>
            <div className={styles.kpiCardBody}>
              <Skel w={90} h={12} />
              <Skel w={120} h={26} />
              <Skel w={70} h={12} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.kpiRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.kpiCard}>
            <Skel w={44} h={44} r={12} />
            <div className={styles.kpiCardBody}>
              <Skel w={80} h={12} />
              <Skel w={100} h={22} />
              <Skel w={120} h={11} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.chartsRow}>
        <div className={styles.chartBox}>
          <Skel w={140} h={16} />
          <div className={styles.bars}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={styles.barWrap}>
                <Skel w="100%" h={`${30 + ((i * 37) % 70)}%`} r={6} />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.chartBox}>
          <Skel w={120} h={16} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skel key={i} w="100%" h={26} r={8} />
          ))}
        </div>
      </div>
      <div className={styles.chartBox}>
        <Skel w={130} h={16} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skel key={i} w="100%" h={20} r={6} />
        ))}
      </div>
    </div>
  );
}

/* ── Variant: settings form ── */
function SettingsSkeleton({ sections = 2 }) {
  return (
    <div className={styles.page}>
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className={styles.formCard}>
          <Skel w={180} h={20} />
          <div className={styles.formField}>
            <Skel w={110} h={12} />
            <Skel w="100%" h={40} r={10} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <Skel w={90} h={12} />
              <Skel w="100%" h={40} r={10} />
            </div>
            <div className={styles.formField}>
              <Skel w={90} h={12} />
              <Skel w="100%" h={40} r={10} />
            </div>
          </div>
          <div className={styles.formField}>
            <Skel w={130} h={12} />
            <Skel w="100%" h={40} r={10} />
          </div>
          <Skel w={140} h={40} r={10} />
        </div>
      ))}
    </div>
  );
}

/**
 * PageSkeleton — drop-in loading layout for staff pages.
 * Render it inside <StaffShell> while data is loading. All variants share the
 * same pulsing-grey rhythm so the whole app feels consistent.
 *
 * variant: 'cards' | 'table' | 'list' | 'analytics' | 'settings'
 */
export default function PageSkeleton({ variant = 'cards', ...rest }) {
  switch (variant) {
    case 'table':     return <TableSkeleton {...rest} />;
    case 'list':      return <ListSkeleton {...rest} />;
    case 'analytics': return <AnalyticsSkeleton {...rest} />;
    case 'settings':  return <SettingsSkeleton {...rest} />;
    case 'cards':
    default:          return <CardsSkeleton {...rest} />;
  }
}
