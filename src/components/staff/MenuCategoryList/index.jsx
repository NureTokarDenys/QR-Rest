import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './menuCategoryList.module.css';
import { MdEdit, MdCheck, MdClose } from "react-icons/md";

export default function MenuCategoryList({ categories, selected, onSelect, onAdd, onRename }) {
  const { t } = useTranslation('components');
  const local = useLocalField();
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  function startEdit(cat, e) {
    e.stopPropagation();
    setEditingId(cat.id);
    setEditValue(local(cat, 'name'));
  }

  function confirmEdit(cat) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== local(cat, 'name')) {
      onRename?.(cat.id, trimmed);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleKeyDown(e, cat) {
    if (e.key === 'Enter') confirmEdit(cat);
    if (e.key === 'Escape') cancelEdit();
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.header}>{t('categories')}</p>
      <button
        className={`${styles.item} ${selected === 'all' ? styles.active : ''}`}
        onClick={() => onSelect('all')}
      >
        {t('all')}
      </button>
      {categories.map(cat => (
        <div key={cat.id} className={styles.catRow}>
          {editingId === cat.id ? (
            <>
              <input
                ref={inputRef}
                className={styles.editInput}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => handleKeyDown(e, cat)}
              />
              <button className={styles.icon} onClick={() => confirmEdit(cat)} aria-label={t('confirm')}>
                <MdCheck className={styles.confirmIcon} />
              </button>
              <button className={styles.icon} onClick={cancelEdit} aria-label={t('cancel')}>
                <MdClose className={styles.cancelIcon} />
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.item} ${selected === cat.id ? styles.active : ''}`}
                onClick={() => onSelect(cat.id)}
              >
                {local(cat, 'name')}
              </button>
              <button className={styles.icon} onClick={e => startEdit(cat, e)} aria-label={t('edit')}>
                <MdEdit className={styles.editIcon} />
              </button>
            </>
          )}
        </div>
      ))}
      <button className={styles.addBtn} onClick={onAdd}>{t('newCategory')}</button>
    </div>
  );
}