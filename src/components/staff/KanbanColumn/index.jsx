import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KanbanCard, { KanbanCardSkeleton } from '../KanbanCard';
import { Skel } from '../Skeleton';
import styles from './kanbanColumn.module.css';

// Per-status colour token reference. Actual colour values live in global.css
// as `--kanban-<status>-{bg|border|text}` so dark theme can override them.
const STATUSES = ['waiting', 'cooking', 'ready', 'served'];

function cssVar(name) {
  return `var(--kanban-${name})`;
}

function colourFor(status) {
  const s = STATUSES.includes(status) ? status : 'waiting';
  return { bg: cssVar(`${s}-bg`), border: cssVar(`${s}-border`), text: cssVar(`${s}-text`) };
}

export default function KanbanColumn({ status, items, onStatusChange }) {
  const { t } = useTranslation('components');
  const cfg = colourFor(status);

  const [isOver, setIsOver] = useState(false);

  // Group cards by orderId so groups from the same order are visually clustered
  const orderClusters = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const oid = item.orderId;
      if (!map.has(oid)) map.set(oid, []);
      map.get(oid).push(item);
    }
    return [...map.entries()].map(([orderId, cards]) => ({
      orderId,
      cards,
      orderColor: cards[0].orderColor,
      tableId:    cards[0].tableId,
    }));
  }, [items]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);

    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    if (onStatusChange) {
      onStatusChange(itemId, status);
    }
  };

  return (
    <div 
      className={styles.column}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={isOver ? { opacity: 0.8, filter: 'brightness(0.95)' } : {}}
    >
      <div className={styles.header} style={{ color: cfg.text }}>
        <span className={styles.colLabel}>{t(`kanban_col_${status}`)}</span>
        <span className={styles.count}>{items.length}</span>
      </div>
      <div className={styles.cards}>
        {orderClusters.map(({ orderId, cards, orderColor, tableId }) => {
          const visibleCards = status === 'waiting'
            ? cards
            : cards.slice(0, 1).map(c =>
                cards.length > 1 ? { ...c, hiddenBelow: cards.length - 1 } : c
              );
          return (
            <div key={orderId} className={styles.orderCluster}>
              <div className={styles.orderClusterHeader} style={{ borderLeftColor: orderColor }}>
                <span className={styles.clusterDot} style={{ background: orderColor }} />
                <span className={styles.clusterTable}>{t('table_number')}{tableId}</span>
                <span className={styles.clusterOrderId}>#{String(orderId).slice(-6)}</span>
              </div>
              {visibleCards.map(item => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  status={status}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Loading placeholder for a kanban column — keeps the coloured column header
 * (page chrome) but renders grey order-cluster placeholders + KanbanCardSkeletons.
 *  - cards: array of per-card configs (see KanbanCardSkeleton props)
 */
export function KanbanColumnSkeleton({ status, cards = [] }) {
  const { t } = useTranslation('components');
  const cfg = colourFor(status);

  return (
    <div className={styles.column}>
      <div className={styles.header} style={{ color: cfg.text }}>
        <span className={styles.colLabel}>{t(`kanban_col_${status}`)}</span>
        <span className={styles.count}><Skel w={10} h={11} /></span>
      </div>
      <div className={styles.cards}>
        {cards.map((cardCfg, i) => (
          <div key={i} className={styles.orderCluster}>
            <div className={styles.orderClusterHeader}>
              <Skel w={8} h={8} r="50%" />
              <Skel w={54} h={11} />
              <Skel w={62} h={10} />
            </div>
            <KanbanCardSkeleton {...cardCfg} />
          </div>
        ))}
      </div>
    </div>
  );
}