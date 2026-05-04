import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import AnalyticsMicro from '../../../components/staff/AnalyticsMicro';
import TopCategoryItem from '../../../components/staff/TopCategoryItem';
import TopDishRow from '../../../components/staff/TopDishRow';
import { ANALYTICS_DATA } from '../../../data/mockData';
import { getRevenue, getOrderStats, getPopularDishes } from '../../../api/admin';
import styles from './analytics.module.css';
import { MdBarChart, MdWarning, MdTimelapse, MdCheckCircle } from 'react-icons/md';

const PERIODS = ['today', 'week', 'month'];

function periodToDates(period) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  let from;
  if (period === 'today') {
    from = to;
  } else if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().slice(0, 10);
  } else {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

function buildAnalyticsData(revenue, orderStats, popularDishes) {
  const base = ANALYTICS_DATA;
  if (!revenue && !orderStats && !popularDishes) return base;

  const completed = orderStats?.completed ?? orderStats?.totalOrders ?? base.orders;
  const voided = orderStats?.void ?? orderStats?.voidedOrders ?? base.voidOrders;
  const total = completed + voided;
  const conversionPct = total > 0 ? Math.round((completed / total) * 100) : base.conversionPct;
  const totalRevenue = revenue?.total ?? revenue?.revenue ?? base.revenue;
  const avgCheck = completed > 0 ? Math.round(totalRevenue / completed) : base.avgCheck;

  const topDishes = Array.isArray(popularDishes)
    ? popularDishes.slice(0, 5).map((d, i) => ({
        num: i + 1,
        name: d.name || d.menuItemId?.name || '—',
        ordered: d.count ?? d.orderedCount ?? 0,
        revenue: d.revenue ?? 0,
        rating: d.rating ?? '—',
      }))
    : base.topDishes;

  return {
    ...base,
    revenue: totalRevenue,
    orders: completed,
    avgCheck,
    completedOrders: completed,
    voidOrders: voided,
    conversionPct,
    topDishes,
    avgCookingMin: orderStats?.avgCookingMin ?? base.avgCookingMin,
  };
}

export default function Analytics() {
  const { t } = useTranslation('analytics');
  const [period, setPeriod] = useState('today');
  const [revenue, setRevenue] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [popularDishes, setPopularDishes] = useState(null);

  useEffect(() => {
    const { from, to } = periodToDates(period);
    Promise.allSettled([
      getRevenue(from, to),
      getOrderStats(from, to),
      getPopularDishes(from, to),
    ]).then(([r, o, p]) => {
      if (r.status === 'fulfilled') setRevenue(r.value);
      if (o.status === 'fulfilled') setOrderStats(o.value);
      if (p.status === 'fulfilled') setPopularDishes(p.value);
    }).catch(err => console.error('Analytics fetch error:', err));
  }, [period]);

  const data = useMemo(() => buildAnalyticsData(revenue, orderStats, popularDishes), [revenue, orderStats, popularDishes]);
  const maxBar = Math.max(...data.hourlyBars);

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
          <button className={styles.exportBtn}>{t('exportCsv')}</button>
        </div>
      }
    >
      <div className={styles.page}>
        {/* Primary KPI row */}
        <div className={styles.kpiRow}>
          <AnalyticsMicro
            label={t('revenue')}
            value={`${data.revenue}₴`}
            change={data.revenueChange}
            changeUp={data.revenueChange > 0}
          />
          <AnalyticsMicro
            label={t('orders')}
            value={data.orders}
            change={data.ordersChange}
            changeUp={data.ordersChange > 0}
          />
          <AnalyticsMicro
            label={t('avgCheck')}
            value={`${data.avgCheck}₴`}
            change={Math.abs(data.avgCheckChange)}
            changeUp={data.avgCheckChange > 0}
          />
        </div>

        {/* Secondary KPI row — new v4.3 metrics */}
        <div className={styles.kpiRow2}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiCardIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
              <MdWarning />
            </div>
            <div className={styles.kpiCardBody}>
              <p className={styles.kpiCardLabel}>{t('walkout')}</p>
              <p className={styles.kpiCardValue}>{data.walkoutCount}</p>
              <p className={`${styles.kpiCardChange} ${data.walkoutChange < 0 ? styles.changeGood : styles.changeBad}`}>
                {data.walkoutChange > 0 ? '+' : ''}{data.walkoutChange} {t('vsYesterday')}
              </p>
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
              <p className={styles.kpiCardValue}>{data.avgCookingMin} {t('min')}</p>
              <p className={`${styles.kpiCardChange} ${data.avgCookingChange < 0 ? styles.changeGood : styles.changeBad}`}>
                {data.avgCookingChange > 0 ? '+' : ''}{data.avgCookingChange} {t('vsYesterday')}
              </p>
            </div>
          </div>
        </div>

        <div className={styles.chartsRow}>
          <div className={styles.chartBox}>
            <p className={styles.chartTitle}>{t('chartTitle')}</p>
            <div className={styles.bars}>
              {data.hourlyBars.map((val, i) => (
                <div key={i} className={styles.barWrap}>
                  <div
                    className={`${styles.bar} ${i === 8 ? styles.barHighlight : ''}`}
                    style={{ height: `${(val / maxBar) * 100}%` }}
                  />
                  <span className={styles.barLabel}>{data.hours[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.catBox}>
            <p className={styles.chartTitle}>{t('topCategories')}</p>
            {data.topCategories.map((cat, i) => (
              <TopCategoryItem key={i} item={cat} />
            ))}
          </div>
        </div>

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
              {data.topDishes.map(dish => (
                <TopDishRow key={dish.num} dish={dish} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
