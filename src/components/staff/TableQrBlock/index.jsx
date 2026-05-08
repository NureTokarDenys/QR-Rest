import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { SOURCE_LANG, fromApiLang } from '../../../i18n/langs';
import { getRestaurant } from '../../../api/admin';
import styles from './tableQrBlock.module.css';

// ── Static per-language strings used in the PDF ────────────────────────────────
const LANG_STRINGS = {
  ua: { tableLabel: n => `Стіл №${n}`,   scanMsg: 'Скануйте для замовлення' },
  en: { tableLabel: n => `Table #${n}`,  scanMsg: 'Scan to order'           },
  pl: { tableLabel: n => `Stół #${n}`,   scanMsg: 'Skanuj, aby zamówić'     },
  de: { tableLabel: n => `Tisch #${n}`,  scanMsg: 'Scannen zum Bestellen'   },
  fr: { tableLabel: n => `Table #${n}`,  scanMsg: 'Scanner pour commander'  },
};
const FALLBACK_STRINGS = { tableLabel: n => `Table #${n}`, scanMsg: 'Scan to order' };

function buildQrUrl(shortCode) {
  return `${window.location.origin}/qr/${shortCode}`;
}

// ── Canvas drawing helpers ─────────────────────────────────────────────────────

function drawHRule(ctx, y, W, color = '#e0e0e0') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, y); ctx.lineTo(W - 60, y);
  ctx.stroke();
  ctx.restore();
}

function drawCentredText(ctx, text, x, y, font, color) {
  ctx.save();
  ctx.font      = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Extract restaurant name for a given i18n lang code from the API response ──
// restaurant.name              = source-lang (ua) name
// restaurant.translations.<apiCode>.name.value = translated name
function resolveRestaurantName(restaurant, langCode) {
  if (!restaurant) return '';
  if (langCode === SOURCE_LANG) return restaurant.name || '';
  // Find the apiCode for this i18n code (e.g. 'en' → 'en', 'ua' → 'uk')
  const apiCode = langCode === 'ua' ? 'uk' : langCode;
  return restaurant.translations?.[apiCode]?.name?.value
    || restaurant.name
    || '';
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TableQrBlock({ tableId, shortCode, tableName }) {
  const { t }     = useTranslation('tableDetail');
  const canvasRef = useRef(null);
  const [qrUrl, setQrUrl]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [restaurant, setRestaurant] = useState(null);

  // Fetch restaurant metadata (languages + name translations) once on mount
  useEffect(() => {
    getRestaurant()
      .then(data => setRestaurant(data))
      .catch(err => console.warn('TableQrBlock: could not load restaurant meta', err));
  }, []);

  // Render QR onto the visible canvas
  useEffect(() => {
    if (!shortCode || !canvasRef.current) return;
    const url = buildQrUrl(shortCode);
    setQrUrl(url);
    setError('');
    QRCode.toCanvas(canvasRef.current, url, {
      width:  180,
      margin: 2,
      color:  { dark: '#111111', light: '#ffffff' },
    }).catch(() => setError('Не вдалося згенерувати QR'));
  }, [shortCode]);

  // ── Derive active languages from the restaurant model ────────────────────────
  // enabledLanguages is [] → means "all supported", otherwise it lists API codes
  // We convert API codes (e.g. 'uk') → i18n codes (e.g. 'ua') via fromApiLang.
  function getActiveLangs() {
    if (!restaurant) return [SOURCE_LANG];
    const enabled = restaurant.enabledLanguages;
    if (!Array.isArray(enabled) || enabled.length === 0) return [SOURCE_LANG];
    return enabled.map(fromApiLang);
  }

  // ── PNG — just the raw QR canvas ─────────────────────────────────────────────
  function handleDownloadPng() {
    if (!canvasRef.current || !qrUrl) return;
    const a    = document.createElement('a');
    a.href     = canvasRef.current.toDataURL('image/png');
    a.download = `qr-table-${tableId}.png`;
    a.click();
  }

  // ── PDF — off-screen Canvas2D for full Unicode rendering ────────────────────
  async function handleDownloadPdf() {
    if (!shortCode || !canvasRef.current || !qrUrl) return;
    setLoading(true);
    setError('');
    try {
      const langs      = getActiveLangs();                        // e.g. ['ua', 'en']
      const displayUrl = qrUrl.replace(/^https?:\/\//, '');
      const QR_PX      = 300;
      const W          = 620;
      const CX         = W / 2;

      // Collect unique restaurant names (deduplicate if multiple langs share the same name)
      const restaurantNames = langs
        .map(l => resolveRestaurantName(restaurant, l))
        .filter(Boolean)
        .filter((name, idx, arr) => arr.indexOf(name) === idx);

      // Pre-calculate canvas height
      const LINE_H = 44;
      let H = 36;
      H += restaurantNames.length * LINE_H;
      H += 20;
      H += 16;
      H += QR_PX;
      H += 16;
      H += langs.length * LINE_H;
      H += langs.length * LINE_H;
      H += 36;
      H += 32;

      const off = document.createElement('canvas');
      off.width  = W;
      off.height = H;
      const ctx  = off.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      let y = 36;

      // ── Restaurant name(s) ────────────────────────────────────────────────
      for (const name of restaurantNames) {
        drawCentredText(ctx, name, CX, y, 'bold 30px Arial, sans-serif', '#111111');
        y += LINE_H;
      }

      // Rule
      y += 10;
      drawHRule(ctx, y, W);
      y += 22;

      // ── QR code ───────────────────────────────────────────────────────────
      await new Promise((resolve, reject) => {
        const img   = new Image();
        img.onload  = () => { ctx.drawImage(img, (W - QR_PX) / 2, y, QR_PX, QR_PX); resolve(); };
        img.onerror = reject;
        img.src     = canvasRef.current.toDataURL('image/png');
      });
      y += QR_PX;

      // Rule
      y += 16;
      drawHRule(ctx, y, W);
      y += 26;

      // ── Table label — one line per language ───────────────────────────────
      for (const lang of langs) {
        const s = LANG_STRINGS[lang] ?? FALLBACK_STRINGS;
        drawCentredText(ctx, s.tableLabel(tableId), CX, y, 'bold 24px Arial, sans-serif', '#222222');
        y += LINE_H;
      }

      // ── "Scan to order" — one line per language ───────────────────────────
      for (const lang of langs) {
        const s = LANG_STRINGS[lang] ?? FALLBACK_STRINGS;
        drawCentredText(ctx, s.scanMsg, CX, y, '21px Arial, sans-serif', '#555555');
        y += LINE_H;
      }

      // ── URL ───────────────────────────────────────────────────────────────
      y += 4;
      drawCentredText(ctx, displayUrl, CX, y, '15px monospace', '#999999');

      // ── Embed in A5 PDF ───────────────────────────────────────────────────
      const doc   = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
      const pw    = doc.internal.pageSize.getWidth();
      const ph    = doc.internal.pageSize.getHeight();
      const mar   = 10;
      const avail = pw - mar * 2;
      const imgH  = avail * (H / W);
      const top   = Math.max(mar, (ph - imgH) / 2);

      doc.addImage(off.toDataURL('image/png'), 'PNG', mar, top, avail, imgH);
      doc.save(`qr-table-${tableId}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Помилка генерації PDF');
    } finally {
      setLoading(false);
    }
  }

  const noQr = !shortCode;

  return (
    <div className={styles.box}>
      <p className={styles.title}>{t('qrCode')}</p>

      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={noQr ? styles.hidden : ''} />
        {noQr && <div className={styles.placeholder}>Немає QR</div>}
      </div>

      {qrUrl && <p className={styles.url}>{shortCode}</p>}
      {error  && <p className={styles.error}>{error}</p>}

      <button className={styles.btnPrimary}  onClick={handleDownloadPng} disabled={!qrUrl}>
        ↓ {t('downloadPng')}
      </button>
      <button className={styles.btnSecondary} onClick={handleDownloadPdf} disabled={loading || noQr}>
        🖨 {t('print')} PDF
      </button>
    </div>
  );
}
