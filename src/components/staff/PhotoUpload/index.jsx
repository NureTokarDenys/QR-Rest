import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './photoUpload.module.css';

export default function PhotoUpload({ images, onChange }) {
  const { t } = useTranslation('dishEdit');
  const inputRef = useRef(null);

  function handleFiles(files) {
    const urls = Array.from(files).map(f => URL.createObjectURL(f));
    onChange && onChange([...(images || []), ...urls]);
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function handleRemove(idx) {
    const next = [...(images || [])];
    next.splice(idx, 1);
    onChange && onChange(next);
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.dropzone}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <span className={styles.icon}>📷</span>
        <p className={styles.hint}>{t('uploadHint')}</p>
        <p className={styles.formats}>{t('uploadFormats')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>
      {images && images.length > 0 && (
        <div className={styles.previews}>
          {images.map((src, i) => (
            <div key={i} className={styles.thumb}>
              <img src={src} alt="" className={styles.thumbImg} />
              <button className={styles.remove} onClick={() => handleRemove(i)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}