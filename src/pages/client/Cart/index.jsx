import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/client/Header';
import CartItem from '../../../components/client/CartItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/client/Footer';
import styles from './cart.module.css';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

import { MdShoppingCart, MdAdd, MdDelete, MdEdit, MdCheck, MdDragIndicator } from 'react-icons/md';

export default function Cart() {
  const { t } = useTranslation('cart');
  const local = useLocalField();
  const navigate = useNavigate();
  const {
    cart, cartTotal, orderComment, setOrderComment,
    servingGroups, addServingGroup, removeServingGroup, renameServingGroup, moveToGroup,
  } = useApp();

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');

  // ── Drag & drop state ───────────────────────────────────────────────────────
  const [dragState, setDragState] = useState(null);
  // dragState shape: { cartItemId, fromGroupId, label, x, y }
  const [dropTarget, setDropTarget] = useState(null); // groupId | null

  // Map groupId → DOM element ref for hit-testing
  const groupEls = useRef({});

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  function getGroupDisplayName(group) {
    if (group.isGeneric) return t('serving_group', { n: group.genericIndex });
    return local(group, 'name');
  }

  function startEditGroup(group) {
    setEditingGroupId(group.id);
    // Pre-fill with whatever the group currently displays (localized if generic)
    setEditGroupName(getGroupDisplayName(group));
  }

  function commitEditGroup() {
    if (editGroupName.trim()) renameServingGroup(editingGroupId, editGroupName.trim());
    setEditingGroupId(null);
  }

  // ── Drag handlers ───────────────────────────────────────────────────────────

  /**
   * Find which group element the pointer is currently over, using bounding rects.
   * Returns the groupId or null.
   */
  const hitTestGroup = useCallback((clientX, clientY) => {
    for (const [groupId, el] of Object.entries(groupEls.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top  && clientY <= rect.bottom
      ) {
        return groupId;
      }
    }
    return null;
  }, []);

  const startDrag = useCallback((e, item) => {
    // Only drag handle triggers this — prevent default to stop text-selection / scroll
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragState({
      cartItemId: item.cartItemId,
      fromGroupId: item.groupId,
      label: local(item, 'name') || item.name_en || '',
      x: e.clientX,
      y: e.clientY,
    });
    setDropTarget(item.groupId);
  }, [local]);

  const onDragMove = useCallback((e) => {
    setDragState(prev => {
      if (!prev) return null;
      return { ...prev, x: e.clientX, y: e.clientY };
    });
    const hit = hitTestGroup(e.clientX, e.clientY);
    setDropTarget(prev => (prev !== hit ? hit : prev));
  }, [hitTestGroup]);

  const onDragEnd = useCallback((e) => {
    setDragState(prev => {
      if (!prev) return null;
      const hit = hitTestGroup(e.clientX, e.clientY);
      if (hit && hit !== prev.fromGroupId) {
        moveToGroup(prev.cartItemId, hit);
      }
      return null;
    });
    setDropTarget(null);
  }, [hitTestGroup, moveToGroup]);

  const multiGroup = servingGroups.length > 1;

  return (
    <div className={styles.page}>
      <Header
        title={t('cart_header')}
        showBack
        rightElement={<span className={styles.count}>{totalItems} {t('position', { count: totalItems })}</span>}
      />

      <div className={styles.content}>
        {cart.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><MdShoppingCart /></span>
            <p>{t('empty')}</p>
          </div>
        ) : (
          <>
            {servingGroups.map(group => {
              const groupItems = cart.filter(i => i.groupId === group.id);
              const isDropTarget = dropTarget === group.id && dragState && dragState.fromGroupId !== group.id;
              return (
                <div
                  key={group.id}
                  ref={el => { groupEls.current[group.id] = el; }}
                  className={`${styles.groupBlock} ${isDropTarget ? styles.groupDropTarget : ''}`}
                >
                  <div className={styles.groupHeader}>
                    {editingGroupId === group.id ? (
                      <>
                        <input
                          className={styles.groupNameInput}
                          value={editGroupName}
                          onChange={e => setEditGroupName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && commitEditGroup()}
                          autoFocus
                        />
                        <button className={styles.groupIconBtn} onClick={commitEditGroup}><MdCheck /></button>
                      </>
                    ) : (
                      <>
                        <span className={styles.groupName}>{getGroupDisplayName(group)}</span>
                        <button className={styles.groupIconBtn} onClick={() => startEditGroup(group)}>
                          <MdEdit />
                        </button>
                        {group.id !== 'main' && (
                          <button className={`${styles.groupIconBtn} ${styles.groupDeleteBtn}`} onClick={() => removeServingGroup(group.id)}>
                            <MdDelete />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className={styles.items}>
                    {groupItems.map(item => {
                      const isDragging = dragState?.cartItemId === item.cartItemId;
                      return (
                        <div
                          key={item.cartItemId}
                          className={`${styles.itemRow} ${isDragging ? styles.itemDragging : ''}`}
                        >
                          {/* Drag handle — shown only when multiple groups exist */}
                          {multiGroup && (
                            <span
                              className={styles.dragHandle}
                              onPointerDown={e => startDrag(e, item)}
                              onPointerMove={onDragMove}
                              onPointerUp={onDragEnd}
                              onPointerCancel={onDragEnd}
                            >
                              <MdDragIndicator />
                            </span>
                          )}
                          <div className={styles.itemContent}>
                            <CartItem item={item} />
                            {multiGroup && (
                              <div className={styles.moveRow}>
                                <span className={styles.moveLabel}>{t('move_to')}</span>
                                {servingGroups.filter(g => g.id !== item.groupId).map(g => (
                                  <button
                                    key={g.id}
                                    className={styles.moveBtn}
                                    onClick={() => moveToGroup(item.cartItemId, g.id)}
                                  >
                                    {getGroupDisplayName(g)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {groupItems.length === 0 && (
                      <p className={styles.emptyGroup}>{t('empty_group')}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add new serving group — creates immediately with a generic name */}
            <button className={styles.addGroupBtn} onClick={addServingGroup}>
              <MdAdd /> {t('add_group')}
            </button>

            <div className={styles.commentBox}>
              <p className={styles.commentLabel}>{t('order_comment')}</p>
              <textarea
                className={styles.textarea}
                placeholder={t('order_comment_placeholder')}
                value={orderComment}
                onChange={e => setOrderComment(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {cart.length > 0 ? (
          <PrimaryButton
            label={`${t('confirm_offer')} ${cartTotal}₴`}
            onClick={() => navigate('/confirm')}
            disabled={cart.length === 0}
          />
        ) : null}
        <SecondaryButton
          label={t('back_to_menu')}
          onClick={() => navigate('/menu')}
        />
      </div>

      <Footer />

      {/* Drag ghost — rendered at document.body so it escapes any overflow:hidden containers */}
      {dragState && createPortal(
        <div
          className={styles.dragGhost}
          style={{ transform: `translate(${dragState.x + 12}px, ${dragState.y - 20}px)` }}
        >
          <MdDragIndicator />
          <span>{dragState.label}</span>
        </div>,
        document.body
      )}
    </div>
  );
}
