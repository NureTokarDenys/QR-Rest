import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fieldFor } from '../../../i18n/langs';
import { Skel } from '../Skeleton';
import styles from './kanbanCard.module.css';

const NEXT_STATUS = { waiting: 'cooking', cooking: 'ready', ready: 'served' };
const BTN_COLORS  = { waiting: '#dc2626', cooking: '#d97706', ready: '#16a34a' };

function formatElapsed(isoTimestamp, now) {
  if (!isoTimestamp) return null;
  const ms = now - new Date(isoTimestamp).getTime();
  if (ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  if (h > 0)        return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  if (totalMin > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
}

function nameOf(obj, lang = 'ua') {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[fieldFor('name', lang)] || obj.name || obj.name_en || '';
}
function getExcluded(item, lang) {
  return (item.excludedIngredients || []).map(x => nameOf(x, lang)).filter(Boolean);
}
function getAddons(item, lang) {
  return (item.addons || []).map(ao => {
    const base = nameOf(typeof ao.addonId === 'object' ? ao.addonId : ao, lang) || nameOf(ao.addon, lang);
    if (!base) return null;
    return ao.quantity > 1 ? `${base} ×${ao.quantity}` : base;
  }).filter(Boolean);
}
function getChoices(item, lang) {
  return (item.componentGroupChoices || []).map(c => {
    const grp = nameOf(typeof c.groupId  === 'object' ? c.groupId  : null, lang) || c.groupName  || '';
    const opt = nameOf(typeof c.optionId === 'object' ? c.optionId : null, lang) || c.optionName || '';
    if (grp && opt) return `${grp}: ${opt}`;
    return opt || grp || null;
  }).filter(Boolean);
}

export default function KanbanCard({ item: group, status, onStatusChange }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('components');
  const lang = i18n.language;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const next    = NEXT_STATUS[status];
  const blocked = next && !group.canAdvance;

  const createdElapsed       = formatElapsed(group.createdAt, now);
  const statusChangedElapsed = group.statusChangedAt
    ? formatElapsed(group.statusChangedAt, now)
    : null;

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', group.id);
    e.dataTransfer.effectAllowed = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    e.dataTransfer.setDragImage(e.currentTarget, e.clientX - rect.left, e.clientY - rect.top);
    setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
  };

  const handleDragEnd = (e) => { e.target.style.opacity = '1'; };

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={styles.card}
      style={group.orderColor ? { borderRightColor: group.orderColor } : {}}
      onClick={() => navigate(`/staff/order/${group.orderId}`)}
    >
      <div className={styles.top}>
        <span style={group.orderColor ? { background: group.orderColor } : {}} className={styles.groupBadge}>
          #{group.groupNumber}
        </span>
        {group.groupName ? <span className={styles.groupName}>{group.groupName}</span> : null}
        <div className={styles.meta}>
          <span className={styles.meta_tag}>{t('table_number')}{group.tableId}</span>
          <span className={styles.meta_tag}>#{group.orderId}</span>
        </div>
      </div>

      {/* ── Dish list ── */}
      <div className={styles.items}>
        {(group.items || []).map(item => {
          const excluded = getExcluded(item, lang);
          const addons   = getAddons(item, lang);
          const choices  = getChoices(item, lang);
          const hasExtras = excluded.length || addons.length || choices.length || item.comment;
          return (
            <div key={item.id} className={`${styles.itemRow} ${hasExtras ? styles.itemRowExpanded : ''}`}>
              <span className={styles.itemQty}>×{item.quantity}</span>
              <div className={styles.itemDetails}>
                <div className={styles.itemNameRow}>
                  <span className={styles.itemName}>{nameOf(item, lang)}</span>
                  {item.categoryName && (
                    <span
                      className={styles.catTag}
                      style={item.categoryColor ? {
                        background: `${item.categoryColor}20`,
                        color: item.categoryColor,
                      } : undefined}
                    >
                      {item.categoryName}
                    </span>
                  )}
                </div>

                {excluded.length > 0 && (
                  <div className={styles.itemMods}>
                    {excluded.map((name, i) => (
                      <span key={i} className={styles.excludedTag}>−{name}</span>
                    ))}
                  </div>
                )}

                {addons.length > 0 && (
                  <div className={styles.itemMods}>
                    {addons.map((label, i) => (
                      <span key={i} className={styles.addonTag}>+{label}</span>
                    ))}
                  </div>
                )}

                {choices.length > 0 && (
                  <div className={styles.itemMods}>
                    {choices.map((label, i) => (
                      <span key={i} className={styles.choiceTag}>{label}</span>
                    ))}
                  </div>
                )}

                {item.comment && (
                  <p className={styles.itemComment}>«{item.comment}»</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Timers ── */}
      <div className={styles.timers}>
        <span className={styles.timerChip} title={t('timer_created_title')}>
          <span className={styles.timerIcon}>⏱</span>
          {createdElapsed ?? '—'}
        </span>
        <span className={`${styles.timerChip} ${styles.timerChipStatus}`} title={t('timer_status_title')}>
          <span className={styles.timerIcon}>⚡</span>
          {statusChangedElapsed ?? '—'}
        </span>
      </div>

      {group.hiddenBelow > 0 && (
        <div className={styles.stackIndicator}>
          +{group.hiddenBelow} {group.hiddenBelow === 1 ? t('more_group') : t('more_groups')}
        </div>
      )}

      {next && (
        <button
          className={`${styles.actionBtn} ${blocked ? styles.actionBtnBlocked : ''}`}
          style={blocked ? undefined : { background: BTN_COLORS[status] }}
          disabled={blocked}
          title={blocked ? t('blocked_by_group', { n: group.blockingGroupNumber }) : undefined}
          onClick={e => {
            e.stopPropagation();
            if (!blocked) onStatusChange && onStatusChange(group.id, next);
          }}
        >
          {blocked ? t('kanban_btn_blocked', { n: group.blockingGroupNumber }) : t(`kanban_btn_${status}`)}
        </button>
      )}
    </div>
  );
}

/**
 * Loading placeholder for a kanban card — same structure & classes as the real
 * card so every grey block lands exactly where its real counterpart will appear.
 *  - withAction: render the action-button placeholder (grey)
 *  - items:      number of dish rows
 *  - withMods:   first row gets a couple of "+addon / -excluded / choice" mod chips
 */
export function KanbanCardSkeleton({ withAction = true, items = 2, withMods = true }) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <Skel w={22} h={22} r={6} />
        <Skel w={96} h={13} />
        <div className={styles.meta}>
          <Skel w={42} h={17} r={5} />
          <Skel w={62} h={17} r={5} />
        </div>
      </div>

      <div className={styles.items}>
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className={`${styles.itemRow} ${withMods ? styles.itemRowExpanded : ''}`}>
            <Skel w={18} h={12} />
            <div className={styles.itemDetails}>
              <div className={styles.itemNameRow}>
                <Skel w={`${52 + ((i * 17) % 28)}%`} h={13} />
                <Skel w={72} h={15} r={4} />
              </div>
              {withMods && i === 0 && (
                <>
                  <div className={styles.itemMods}>
                    <Skel w={64} h={15} r={4} />
                    <Skel w={56} h={15} r={4} />
                  </div>
                  <div className={styles.itemMods}>
                    <Skel w={130} h={13} r={4} />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.timers}>
        <Skel w={58} h={19} r={5} />
        <Skel w={54} h={19} r={5} />
      </div>

      {withAction && <Skel w={120} h={26} r={6} style={{ marginTop: 2 }} />}
    </div>
  );
}
