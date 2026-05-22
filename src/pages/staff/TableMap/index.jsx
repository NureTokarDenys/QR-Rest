import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import StaffShell from '../../../components/staff/StaffShell';
import TableMapItem, { TableMapItemSkeleton } from '../../../components/staff/TableMapItem';
import { Skel } from '../../../components/staff/Skeleton';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { createTable, updateTable, deleteTable, reorderTables } from '../../../api/admin';
import { resolveWaiterCall } from '../../../api/orders';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useAuth } from '../../../context/AuthContext';
import { useStaffData } from '../../../context/StaffDataContext';
import styles from './tableMap.module.css';

import {
  MdMap, MdNotificationsActive, MdCheck,
  MdEdit, MdDelete, MdDragIndicator, MdAdd,
} from 'react-icons/md';

function formatElapsedShort(ms) {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs < 10 ? '0' : ''}${rs}s`;
}

const LEGEND = [
  { key: 'free',   className: 'free',   label_ua: 'Вільний',         label_en: 'Free' },
  { key: 'busy',   className: 'busy',   label_ua: 'Зайнятий',        label_en: 'Busy' },
  { key: 'waiter', className: 'waiter', label_ua: 'Виклик офіціанта', label_en: 'Waiter called' },
  { key: 'bill',   className: 'bill',   label_ua: 'Рахунок',          label_en: 'Bill requested' },
];

function mapStatus(apiStatus) {
  if (!apiStatus) return 'free';
  const s = apiStatus.toLowerCase();
  if (s === 'occupied') return 'busy';
  return s;
}

function mapDishes(items = []) {
  return items.map(i => {
    const mi = typeof i.menuItemId === 'object' ? i.menuItemId : null;
    return {
      name:    mi?.name    || i.name    || '—',
      name_en: mi?.name_en || mi?.name  || i.name || '—',
      status:  i.dishStatus,
    };
  });
}

function normaliseTable(t) {
  const raw      = t.currentOrder ?? null;
  const call     = t.activeWaiterCall ?? null;
  const callType = call?.type ?? null;

  let status = mapStatus(t.status);
  if (callType === 'cash_payment') status = 'bill';
  else if (callType === 'call')    status = 'waiter';

  return {
    _id:            t._id,
    id:             t.number ?? t._id,
    mapOrder:       t.mapOrder ?? 0,
    name:           t.name || t.label || `Стіл ${t.number}`,
    number:         t.number,
    label:          t.label ?? '',
    capacity:       t.capacity ?? 4,
    status,
    waiterCall:     callType === 'call',
    waiterCallCash: callType === 'cash_payment',
    seats:          t.capacity ?? t.seats ?? 4,
    orders:         raw ? [{ id: raw._id, dishes: mapDishes(raw.items) }] : [],
  };
}

function sortTables(arr) {
  return [...arr].sort((a, b) => {
    if (a.mapOrder !== b.mapOrder) return a.mapOrder - b.mapOrder;
    return a.id - b.id;
  });
}

const CALL_EVENTS   = new Set(['WAITER_CALL', 'WAITER_CALL_CASH', 'WAITER_CALL_RESOLVED']);
const RELOAD_EVENTS = new Set([...CALL_EVENTS, 'ORDER_NEW', 'ORDER_VOID', 'ORDER_CANCELLED', 'TABLE_STATUS_UPDATED']);

const EMPTY_FORM = { number: '', label: '', capacity: '' };

export default function TableMap() {
  const { t, i18n }   = useTranslation('tableMap');
  const lang          = i18n.language;
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const isAdmin       = ['admin', 'root_admin'].includes(user?.role);

  // ── Live table data — shared cache (single source of truth) ─────────────────
  const { tables: rawTables, refreshTables, ensureTables } = useStaffData();
  useEffect(() => { ensureTables(); }, [ensureTables]);
  const loading = rawTables === null;
  const tables = (rawTables && rawTables.length > 0)
    ? sortTables(rawTables.filter(t => t.status !== 'disabled' && t.isActive !== false).map(normaliseTable))
    : [];

  // ── Waiter call toast ────────────────────────────────────────────────────────
  const [callToast, setCallToast] = useState(null);
  const [toastNow, setToastNow]   = useState(() => Date.now());

  useEffect(() => {
    if (!callToast || callToast.resolved) return;
    const id = setInterval(() => setToastNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [callToast?.callId, callToast?.resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedDismissRef = useRef(null);
  useEffect(() => {
    clearTimeout(resolvedDismissRef.current);
    if (callToast?.resolved) {
      resolvedDismissRef.current = setTimeout(() => setCallToast(null), 5000);
    }
    return () => clearTimeout(resolvedDismissRef.current);
  }, [callToast?.resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]         = useState(false);
  const [localTables, setLocalTables]   = useState([]);  // working copy while editing
  const [savingLayout, setSavingLayout] = useState(false);
  const [saveError, setSaveError]       = useState('');

  // drag-and-drop
  const draggedIdx  = useRef(null);
  const dragOverIdx = useRef(null);
  const [, forceRender] = useState(0); // to trigger re-render on drag state change

  // modal (add / edit)
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add, obj = edit existing
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────
  // Tables themselves come from the shared StaffDataContext cache. This page
  // only handles call-toast UI on top of WS events; the cache invalidates
  // itself when TABLE_* / ORDER_* / WAITER_CALL_* events arrive.
  const handleWsMessage = useCallback((msg) => {
    if (msg.event === 'WAITER_CALL' || msg.event === 'WAITER_CALL_CASH') {
      setCallToast({
        tableNumber: msg.payload?.tableNumber,
        tableId:     msg.payload?.tableId,
        callId:      msg.payload?.callId,
        type:        msg.event,
        createdAt:   msg.payload?.createdAt ? new Date(msg.payload.createdAt).getTime() : Date.now(),
        resolved:    false,
        resolvedAt:  null,
        accepting:   false,
      });
      setToastNow(Date.now());
    }

    if (msg.event === 'WAITER_CALL_RESOLVED') {
      setCallToast(prev => {
        if (!prev || prev.resolved) return prev;
        if (prev.callId && msg.payload?.callId &&
            String(prev.callId) !== String(msg.payload.callId)) return prev;
        return { ...prev, resolved: true, resolvedAt: new Date().toLocaleTimeString() };
      });
    }
  }, []);

  const { status: wsStatus } = useWebSocket({ onMessage: handleWsMessage });

  // ── Toast accept ─────────────────────────────────────────────────────────────
  async function handleAcceptFromToast() {
    if (!callToast) return;
    if (callToast.callId) {
      setCallToast(prev => prev ? { ...prev, accepting: true } : null);
      try { await resolveWaiterCall(callToast.callId); } catch { /* navigate anyway */ }
    }
    navigate(`/staff/table/${callToast.tableNumber}`);
  }

  // ── Edit mode helpers ─────────────────────────────────────────────────────────
  function enterEditMode() {
    setLocalTables(sortTables(tables));
    setSaveError('');
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setLocalTables([]);
    setSaveError('');
  }

  async function saveLayout() {
    setSavingLayout(true);
    setSaveError('');
    try {
      const order = localTables.map((tbl, idx) => ({ id: tbl._id, mapOrder: idx }));
      await reorderTables(order);
      // Cache will auto-refresh via TABLES_REORDERED WS event, but trigger an
      // immediate refetch too so the page reflects the new order instantly.
      await refreshTables();
      setEditMode(false);
      setLocalTables([]);
    } catch {
      setSaveError(t('save_error'));
    } finally {
      setSavingLayout(false);
    }
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────────
  function onDragStart(idx) {
    draggedIdx.current  = idx;
    dragOverIdx.current = idx;
  }

  function onDragEnter(idx) {
    if (draggedIdx.current === null || draggedIdx.current === idx) return;
    dragOverIdx.current = idx;
    setLocalTables(prev => {
      const next = [...prev];
      const [removed] = next.splice(draggedIdx.current, 1);
      next.splice(idx, 0, removed);
      draggedIdx.current = idx;
      return next;
    });
    forceRender(n => n + 1);
  }

  function onDragEnd() {
    draggedIdx.current  = null;
    dragOverIdx.current = null;
    forceRender(n => n + 1);
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  function openAddModal() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(tbl) {
    setEditTarget(tbl);
    setForm({ number: String(tbl.number ?? ''), label: tbl.label ?? '', capacity: String(tbl.capacity ?? '') });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
    setFormError('');
  }

  async function handleModalSave() {
    const num = parseInt(form.number, 10);
    if (!form.number || isNaN(num) || num < 1) {
      setFormError(t('number_required'));
      return;
    }
    // Client-side duplicate check — exclude the table being edited
    const others = localTables.filter(tbl => !editTarget || tbl._id !== editTarget._id);
    if (others.some(tbl => tbl.number === num)) {
      setFormError(t('duplicateNumber', 'A table with this number already exists'));
      return;
    }
    setModalSaving(true);
    setFormError('');
    try {
      const payload = {
        number:   num,
        label:    form.label.trim() || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
      };

      if (editTarget) {
        // update existing
        const updated = await updateTable(editTarget._id, payload);
        setLocalTables(prev => prev.map(tbl =>
          tbl._id === editTarget._id
            ? normaliseTable({ ...tbl, ...updated, _id: editTarget._id })
            : tbl
        ));
      } else {
        // create new
        const created = await createTable(payload);
        const norm = normaliseTable(created);
        setLocalTables(prev => [...prev, norm]);
      }
      closeModal();
    } catch (err) {
      const code = err?.response?.data?.error?.code || err?.response?.data?.error?.message;
      if (code === 'TABLE_NUMBER_EXISTS') {
        setFormError(t('duplicateNumber', 'A table with this number already exists'));
      } else {
        setFormError(err?.response?.data?.error?.message || t('save_error'));
      }
    } finally {
      setModalSaving(false);
    }
  }

  async function handleModalDelete() {
    if (!editTarget) return;
    setModalSaving(true);
    try {
      await deleteTable(editTarget._id);
      // Optimistic update of the working copy; the shared cache is refreshed
      // by the TABLE_DELETED WS event so all open pages stay consistent.
      setLocalTables(prev => prev.filter(tbl => tbl._id !== editTarget._id));
      refreshTables();
      closeModal();
    } catch (err) {
      setFormError(err?.response?.data?.error?.message || t('save_error'));
    } finally {
      setModalSaving(false);
    }
  }

  // Direct delete from the trash icon on a card (with confirmation)
  async function handleDirectDelete(tbl) {
    if (!tbl?._id) return;
    if (!window.confirm(t('confirm_delete'))) return;
    try {
      await deleteTable(tbl._id);
      setLocalTables(prev => prev.filter(x => x._id !== tbl._id));
      refreshTables();
    } catch (err) {
      setSaveError(err?.response?.data?.error?.message || t('save_error'));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const displayTables = editMode ? localTables : tables;

  // ── Skeleton (first load) — replicates the real hall layout 1:1 ──────────────
  if (loading) {
    // Same shape variety the real map shows (free / occupied / with call badge)
    const SKELETON_CARDS = [
      { withDishes: false, withBadge: false },
      { withDishes: true,  withBadge: true,  dishRows: 4 },
      { withDishes: true,  withBadge: false, dishRows: 2 },
      { withDishes: true,  withBadge: true,  dishRows: 3 },
      { withDishes: true,  withBadge: true,  dishRows: 4 },
      { withDishes: false, withBadge: false },
    ];
    return (
      <StaffShell title={<><MdMap /> {t('title')}</>}>
        <div className={styles.page}>
          {/* Legend */}
          <div className={styles.legendRow}>
            {LEGEND.map(l => (
              <div key={l.key} className={styles.legendItem}>
                <Skel w={10} h={10} r="50%" />
                <Skel w={70 + ((l.key.length * 9) % 40)} h={12} />
              </div>
            ))}
          </div>

          {/* Hall */}
          <div className={styles.hall}>
            <div className={styles.hallHeader}>
              <Skel w={190} h={18} />
              {isAdmin && <Skel w={160} h={30} r={8} />}
            </div>

            <div className={styles.tablesGrid}>
              {SKELETON_CARDS.map((cfg, i) => (
                <div key={i} className={styles.tableSlot}>
                  <TableMapItemSkeleton {...cfg} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title={<><MdMap /> {t('title')}</>}>
      <WsStatusBanner status={wsStatus} />

      {/* Waiter call toast */}
      {callToast && (
        <div
          className={`${styles.callToast} ${callToast.type === 'WAITER_CALL_CASH' ? styles.callToastCash : ''} ${callToast.resolved ? styles.callToastResolved : ''}`}
          onClick={() => !callToast.resolved && navigate(`/staff/table/${callToast.tableNumber}`)}
          style={!callToast.resolved ? { cursor: 'pointer' } : undefined}
        >
          {callToast.resolved
            ? <MdCheck className={styles.callToastIcon} />
            : <MdNotificationsActive className={styles.callToastIcon} />
          }
          <div className={styles.callToastBody}>
            <span className={styles.callToastTitle}>
              {callToast.resolved
                ? t('toast_answered', { n: callToast.tableNumber ?? '?' })
                : callToast.type === 'WAITER_CALL_CASH'
                  ? t('toast_cash', { n: callToast.tableNumber ?? '?' })
                  : t('toast_call', { n: callToast.tableNumber ?? '?' })}
            </span>
            {!callToast.resolved && callToast.createdAt && (
              <span className={styles.callToastMeta}>
                {t('toast_waiting', { time: formatElapsedShort(toastNow - callToast.createdAt) })}
              </span>
            )}
            {callToast.resolved && callToast.resolvedAt && (
              <span className={styles.callToastMeta}>{t('toast_resolved_at', { time: callToast.resolvedAt })}</span>
            )}
          </div>
          {!callToast.resolved && (
            <button
              className={styles.callToastAcceptBtn}
              onClick={e => { e.stopPropagation(); handleAcceptFromToast(); }}
              disabled={callToast.accepting}
            >
              {callToast.accepting ? '…' : <><MdCheck /> {t('toast_accept')}</>}
            </button>
          )}
          <button className={styles.callToastClose} onClick={e => { e.stopPropagation(); setCallToast(null); }}>✕</button>
        </div>
      )}

      <div className={styles.page}>
        {/* Legend */}
        <div className={styles.legendRow}>
          {LEGEND.map(l => (
            <div key={l.key} className={styles.legendItem}>
              <span className={`${styles.dot} ${styles[l.className]}`} />
              <span className={styles.legendLabel}>
                {lang === 'en' ? l.label_en : l.label_ua}
              </span>
            </div>
          ))}
        </div>

        {/* Hall */}
        <div className={styles.hall}>
          <div className={styles.hallHeader}>
            <p className={styles.hallTitle}>{t('hallTitle')}</p>

            {isAdmin && !editMode && (
              <button className={styles.editMapBtn} onClick={enterEditMode} title={t('edit_map_tooltip')}>
                <MdEdit />
                {t('edit_map_tooltip')}
              </button>
            )}

            {isAdmin && editMode && (
              <div className={styles.editModeBar}>
                <span className={styles.editModeLabel}>{t('edit_mode_title')}</span>
                {saveError && <span className={styles.saveErrorMsg}>{saveError}</span>}
                <button
                  className={`${styles.editActionBtn} ${styles.cancelBtn}`}
                  onClick={cancelEditMode}
                  disabled={savingLayout}
                >
                  {t('cancel_edit')}
                </button>
                <button
                  className={`${styles.editActionBtn} ${styles.savBtn}`}
                  onClick={saveLayout}
                  disabled={savingLayout}
                >
                  {savingLayout ? '…' : t('save_layout')}
                </button>
              </div>
            )}
          </div>

          <div className={styles.tablesGrid}>
            {displayTables.map((table, idx) =>
              editMode ? (
                /* ─ Draggable edit card ─ */
                <div
                  key={table._id || table.id}
                  className={`${styles.editCard} ${draggedIdx.current === idx ? styles.editCardDragging : ''}`}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragEnter={() => onDragEnter(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnd={onDragEnd}
                >
                  <span className={styles.dragHandle}><MdDragIndicator /></span>

                  {/* Render the normal card inside — it shows name/status */}
                  <div style={{ pointerEvents: 'none' }}>
                    <TableMapItem table={table} />
                  </div>

                  <div className={styles.editCardActions}>
                    <button
                      className={`${styles.iconBtn} ${styles.editIconBtn}`}
                      onClick={e => { e.stopPropagation(); openEditModal(table); }}
                      title={t('edit_table_title')}
                    >
                      <MdEdit />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                      onClick={e => { e.stopPropagation(); handleDirectDelete(table); }}
                      title={t('delete_table')}
                    >
                      <MdDelete />
                    </button>
                  </div>
                </div>
              ) : (
                /* ─ Normal view card ─ */
                <div key={table._id || table.id} className={styles.tableSlot}>
                  <TableMapItem table={table} />
                </div>
              )
            )}

            {/* Add table card — only in edit mode */}
            {editMode && (
              <button className={styles.addTableCard} onClick={openAddModal}>
                <span className={styles.addTableIcon}><MdAdd /></span>
                {t('add_table')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {editTarget ? t('edit_table_title') : t('add_table_title')}
            </h3>

            <div className={styles.modalField}>
              <label>{t('field_number')}</label>
              <input
                type="number"
                min={1}
                value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                autoFocus
              />
              {formError && <span className={styles.fieldError}>{formError}</span>}
            </div>

            <div className={styles.modalField}>
              <label>{t('field_label')}</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder={t('field_label')}
              />
            </div>

            <div className={styles.modalField}>
              <label>{t('field_capacity')}</label>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
              />
            </div>

            <div className={styles.modalActions}>
              {editTarget && (
                <button
                  className={styles.modalDeleteBtn}
                  onClick={handleModalDelete}
                  disabled={modalSaving}
                >
                  {t('delete_table')}
                </button>
              )}
              <button className={styles.modalCancelBtn} onClick={closeModal} disabled={modalSaving}>
                {t('cancel_edit')}
              </button>
              <button className={styles.modalSaveBtn} onClick={handleModalSave} disabled={modalSaving}>
                {modalSaving ? '…' : t('save_layout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
