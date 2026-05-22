import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import PageSkeleton from '../../../components/staff/Skeleton';
import AnalyticsMicro from '../../../components/staff/AnalyticsMicro';
import TopCategoryItem from '../../../components/staff/TopCategoryItem';
import TopDishRow from '../../../components/staff/TopDishRow';
import { getRevenue, getOrderStats, getPopularDishes, getTopCategories, exportAnalyticsCsv } from '../../../api/admin';
import styles from './analytics.module.css';
import { MdBarChart, MdWarning, MdTimelapse, MdCheckCircle, MdDownload } from 'react-icons/md';

const PERIODS = ['today', 'week', 'month'];

// ── Date helpers ──────────────────────────────────────────────────────────────

function periodToDates(period) {
  const now = new Date();
  const to  = now.toISOString().slice(0, 10);
  let from;
  if (period === 'today') {
    from = to;
  } else if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    from = d.toISOString().slice(0, 10);
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

/** Generate array of ISO date strings from `from` to `to` inclusive. */
function dateSeries(from, to) {
  const dates = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_DAYS_UA = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function shortDay(isoDate, lang) {
  const d = new Date(isoDate);
  return lang === 'ua' ? SHORT_DAYS_UA[d.getDay()] : SHORT_DAYS[d.getDay()];
}

// ── Chart data builder ────────────────────────────────────────────────────────

function buildChart(period, from, to, breakdown, lang) {
  if (!breakdown || breakdown.length === 0) {
    if (period === 'today') {
      return {
        bars:   Array(24).fill(0),
        labels: Array.from({ length: 24 }, (_, h) => h % 2 === 0 ? `${h}` : ''),
      };
    }
    const days = dateSeries(from, to);
    return {
      bars:   Array(days.length).fill(0),
      labels: period === 'week'
        ? days.map(d => shortDay(d, lang))
        : days.map(d => d.slice(-2)),
    };
  }

  if (period === 'today') {
    const map = {};
    breakdown.forEach(b => { map[b.hour] = b.revenue; });
    return {
      bars:   Array.from({ length: 24 }, (_, h) => map[h] ?? 0),
      labels: Array.from({ length: 24 }, (_, h) => h % 2 === 0 ? `${h}` : ''),
    };
  }

  // week / month — daily
  const days = dateSeries(from, to);
  const map  = {};
  breakdown.forEach(b => { map[b.date] = b.revenue; });
  return {
    bars:   days.map(d => map[d] ?? 0),
    labels: period === 'week'
      ? days.map(d => shortDay(d, lang))
      : days.map((d, i) => {
          // For month: label every 5th day + last day to avoid crowding
          const day = parseInt(d.slice(-2), 10);
          return (day % 5 === 1 || i === days.length - 1) ? String(day) : '';
        }),
  };
}

// ── Analytics data builder ───────────────────────────────────────────────────

function buildAnalyticsData(period, from, to, revenue, orderStats, popularDishes, topCats, lang) {
  const totalRevenue = revenue?.total ?? 0;

  const statsMap = {};
  if (Array.isArray(orderStats)) {
    orderStats.forEach(s => { if (s._id) statsMap[s._id] = s.count ?? 0; });
  }
  const completed    = (statsMap.completed_cash ?? 0) + (statsMap.completed_epay ?? 0);
  const voided       = statsMap.cancelled ?? 0;
  const total        = completed + voided;
  const conversionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avgCheck      = completed > 0 ? Math.round(totalRevenue / completed) : 0;

  const topDishes = Array.isArray(popularDishes)
    ? popularDishes.slice(0, 5).map((d, i) => ({
        num:     i + 1,
        name:    d.name    || '—',
        name_en: d.name_en || d.name || '—',
        ordered: d.totalQty ?? 0,
        revenue: Math.round(d.revenue ?? 0),
        rating:  d.rating  ?? '—',
      }))
    : [];

  const topCategories = Array.isArray(topCats) ? topCats : [];

  const { bars, labels } = buildChart(period, from, to, revenue?.breakdown, lang);

  return {
    revenue: totalRevenue,
    orders:  completed,
    avgCheck,
    completedOrders:  completed,
    voidOrders:       voided,
    conversionPct,
    topDishes,
    topCategories,
    bars,
    labels,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { t, i18n } = useTranslation('analytics');
  const lang = i18n.language;

  const [period, setPeriod]           = useState('today');
  const [revenue, setRevenue]         = useState(null);
  const [orderStats, setOrderStats]   = useState(null);
  const [popularDishes, setPopular]   = useState(null);
  const [topCats, setTopCats]         = useState(null);
  const [exporting, setExporting]     = useState(false);

  const { from, to } = useMemo(() => periodToDates(period), [period]);

  useEffect(() => {
    setRevenue(null); setOrderStats(null); setPopular(null); setTopCats(null);
    Promise.allSettled([
      getRevenue(from, to),
      getOrderStats(from, to),
      getPopularDishes(from, to),
      getTopCategories(from, to),
    ]).then(([r, o, p, c]) => {
      if (r.status === 'fulfilled') setRevenue(r.value);
      if (o.status === 'fulfilled') setOrderStats(o.value);
      if (p.status === 'fulfilled') setPopular(p.value);
      if (c.status === 'fulfilled') setTopCats(c.value);
    });
  }, [from, to]);

  const data   = useMemo(
    () => buildAnalyticsData(period, from, to, revenue, orderStats, popularDishes, topCats, lang),
    [period, from, to, revenue, orderStats, popularDishes, topCats, lang],
  );
  const maxBar = Math.max(...data.bars, 1);

  const loading = revenue === null && orderStats === null && popularDishes === null && topCats === null;

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await exportAnalyticsCsv(from, to);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `analytics-${period}-${from}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [from, to, period]);

  if (loading) {
    return (
      <StaffShell title={<><MdBarChart className={styles.headerIcon} /> {t('title')}</>}>
        <PageSkeleton variant="analytics" />
      </StaffShell>
    );
  }

  return (
    <StaffShell
      title={<><MdBarChart className={styles.headerIcon} /> {t('title')}</>}
      rightActions={
        <div className={styles.headerActions}>
          <div className={styles.periods}>
            {PERIODS.map(p => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {t(p)}
              </button>
            ))}
          </div>
          <button
            className={`${styles.exportBtn} ${exporting ? styles.exportBtnBusy : ''}`}
            onClick={handleExport}
            disabled={exporting}
          >
            <MdDownload style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }} />
            {exporting ? '…' : t('exportCsv')}
          </button>
        </div>
      }
    >
      <div className={styles.page}>
        {/* Primary KPI row */}
        <div className={styles.kpiRow}>
          <AnalyticsMicro label={t('revenue')}  value={`${Math.round(data.revenue)}₴`} />
          <AnalyticsMicro label={t('orders')}   value={data.orders} />
          <AnalyticsMicro label={t('avgCheck')} value={`${data.avgCheck}₴`} />
        </div>

        {/* Secondary KPI row */}
        <div className={styles.kpiRow2}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiCardIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
              <MdWarning />
            </div>
            <div className={styles.kpiCardBody}>
              <p className={styles.kpiCardLabel}>{t('walkout')}</p>
              <p className={styles.kpiCardValue}>{data.voidOrders}</p>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiCardIcon} style={{ background: '#e8f5e9', color: '#2e7d32' }}>
              <MdCheckCircle />
            </div>
            <div className={styles.kpiCardBody}>
              <p className={styles.kpiCardLabel}>{t('conversion')}</p>
              <p className={styles.kpiCardValue}>{data.conversionPct}%</p>
              <p className={styles.kpiCardSub}>
                {data.completedOrders} {t('completed')} / {data.voidOrders} {t('void')}
              </p>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiCardIcon} style={{ background: '#fff3e0', color: '#f57c00' }}>
              <MdTimelapse />
            </div>
            <div className={styles.kpiCardBody}>
              <p className={styles.kpiCardLabel}>{t('avgCooking')}</p>
              <p className={styles.kpiCardValue}>— {t('min')}</p>
            </div>
          </div>
        </div>

        <div className={styles.chartsRow}>
          {/* Bar chart */}
          <div className={styles.chartBox}>
            <p className={styles.chartTitle}>{t(`chartTitle_${period}`)}</p>
            {data.bars.every(v => v === 0) ? (
              <p className={styles.noDataMsg}>{t('noData')}</p>
            ) : (
              <div className={styles.bars}>
                {data.bars.map((val, i) => (
                  <div key={i} className={styles.barWrap}>
                    <div
                      className={`${styles.bar} ${val === Math.max(...data.bars) ? styles.barHighlight : ''}`}
                      style={{ height: `${(val / maxBar) * 100}%` }}
                      title={`${data.labels[i] || i}: ${Math.round(val)}₴`}
                    />
                    {data.labels[i] ? (
                      <span className={styles.barLabel}>{data.labels[i]}</span>
                    ) : (
                      <span className={styles.barLabelEmpty} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top categories */}
          <div className={styles.catBox}>
            <p className={styles.chartTitle}>{t('topCategories')}</p>
            {data.topCategories.length === 0 ? (
              <p className={styles.noDataMsg}>{t('noData')}</p>
            ) : (
              data.topCategories.map((cat, i) => (
                <TopCategoryItem key={i} item={cat} />
              ))
            )}
          </div>
        </div>

        {/* Top dishes table */}
        <div className={styles.tableBox}>
          <p className={styles.chartTitle}>{t('topDishes')}</p>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead}>
                <th>{t('num')}</th>
                <th>{t('dish')}</th>
                <th>{t('ordered')}</th>
                <th>{t('dishRevenue')}</th>
                <th>{t('rating')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topDishes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--secondary-text)' }}>
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                data.topDishes.map(dish => (
                  <TopDishRow key={dish.num} dish={dish} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
