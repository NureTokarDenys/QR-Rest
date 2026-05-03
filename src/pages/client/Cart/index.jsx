import React, { useState } from 'react';
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

import { MdShoppingCart, MdAdd, MdDelete, MdEdit, MdCheck } from 'react-icons/md';

export default function Cart() {
  const { t } = useTranslation('cart');
  const local = useLocalField();
  const navigate = useNavigate();
  const {
    cart, cartTotal, orderComment, setOrderComment,
    servingGroups, addServingGroup, removeServingGroup, renameServingGroup, moveToGroup,
  } = useApp();

  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [movingItemId, setMovingItemId] = useState(null);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  function handleAddGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    addServingGroup(name);
    setNewGroupName('');
    setAddingGroup(false);
  }

  function startEditGroup(group) {
    setEditingGroupId(group.id);
    setEditGroupName(local(group, 'name'));
  }

  function commitEditGroup() {
    if (editGroupName.trim()) renameServingGroup(editingGroupId, editGroupName.trim());
    setEditingGroupId(null);
  }

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
              if (groupItems.length === 0 && group.id !== 'main') return null;
              return (
                <div key={group.id} className={styles.groupBlock}>
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
                        <span className={styles.groupName}>{local(group, 'name')}</span>
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
                    {groupItems.map(item => (
                      <div key={item.cartItemId} className={styles.itemRow}>
                        <CartItem item={item} />
                        {servingGroups.length > 1 && (
                          <div className={styles.moveRow}>
                            <span className={styles.moveLabel}>{t('move_to')}</span>
                            {servingGroups.filter(g => g.id !== item.groupId).map(g => (
                              <button
                                key={g.id}
                                className={styles.moveBtn}
                                onClick={() => moveToGroup(item.cartItemId, g.id)}
                              >
                                {local(g, 'name')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {groupItems.length === 0 && (
                      <p className={styles.emptyGroup}>{t('empty_group')}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add new serving group */}
            {addingGroup ? (
              <div className={styles.addGroupRow}>
                <input
                  className={styles.groupNameInput}
                  placeholder={t('group_name_placeholder')}
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value.slice(0, 50))}
                  onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                  autoFocus
                />
                <button className={styles.addGroupConfirm} onClick={handleAddGroup}><MdCheck /></button>
                <button className={styles.addGroupCancel} onClick={() => { setAddingGroup(false); setNewGroupName(''); }}>✕</button>
              </div>
            ) : (
              <button className={styles.addGroupBtn} onClick={() => setAddingGroup(true)}>
                <MdAdd /> {t('add_group')}
              </button>
            )}

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
    </div>
  );
}
