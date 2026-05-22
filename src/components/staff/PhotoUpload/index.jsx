import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdAddAPhoto, MdClose, MdFullscreen } from 'react-icons/md';
import Lightbox from '../../client/Lightbox';
import styles from './photoUpload.module.css';

// images:               Array<{ url: string, file: File | null }>
// selectedIdx:          index of the primary image
// onChange(images, selectedIdx)
// maxImages:            max allowed images (default: Infinity)
// onAttemptBeyondLimit: called when user tries to add beyond maxImages
export default function PhotoUpload({ images = [], selectedIdx = 0, onChange, maxImages = Infinity, onAttemptBeyondLimit }) {
  const { t } = useTranslation('components');
  const inputRef = useRef(null);
  // null when closed, otherwise the index of the image being previewed.
  const [lightboxIdx, setLightboxIdx] = useState(null);

  const atLimit = images.length >= maxImages;

  function handleFiles(files) {
    if (atLimit) { onAttemptBeyondLimit?.(); return; }
    const slots = maxImages - images.length;
    const added = Array.from(files).slice(0, slots).map(f => ({ url: URL.createObjectURL(f), file: f }));
    const next  = [...images, ...added];
    onChange?.(next, next.length - 1);
  }

  function handleRemove(e, idx) {
    e.stopPropagation();
    const next    = images.filter((_, i) => i !== idx);
    let nextSel   = selectedIdx;
    if (next.length === 0)        nextSel = 0;
    else if (idx === selectedIdx) nextSel = 0;
    else if (idx < selectedIdx)   nextSel = selectedIdx - 1;
    onChange?.(next, Math.min(nextSel, Math.max(0, next.length - 1)));
  }

  function handleSelect(idx) {
    if (idx !== selectedIdx) onChange?.(images, idx);
  }

  return (
    <div className={styles.wrapper}>
      {!atLimit && (
        <div
          className={styles.dropzone}
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
        >
          <MdAddAPhoto className={styles.icon} />
          <p className={styles.hint}>{t('uploadHint')}</p>
          <p className={styles.formats}>{t('uploadFormats')}</p>
          <p className={styles.resolutionHint}>{t('uploadResolutionHint')}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {images.length > 0 && (
        <div className={styles.thumbs}>
          {images.map((img, i) => (
            <div
              key={i}
              className={`${styles.thumb} ${i === selectedIdx ? styles.thumbActive : ''}`}
              onClick={() => handleSelect(i)}
            >
              <img src={img.url} alt="" className={styles.thumbImg} />
              <button
                className={styles.expand}
                type="button"
                title={t('previewFullscreen', 'Переглянути на весь екран')}
                onClick={e => { e.stopPropagation(); setLightboxIdx(i); }}
              >
                <MdFullscreen size={11} />
              </button>
              <button className={styles.remove} type="button" onClick={e => handleRemove(e, i)}>
                <MdClose size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Lightbox
        images={images.map(img => img.url)}
        initialIndex={lightboxIdx ?? 0}
        open={lightboxIdx !== null}
        onClose={() => setLightboxIdx(null)}
      />
    </div>
  );
}
