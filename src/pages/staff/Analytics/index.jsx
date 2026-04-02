import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import AnalyticsMicro from '../../../components/staff/AnalyticsMicro';
import TopCategoryItem from '../../../components/staff/TopCategoryItem';
import TopDishRow from '../../../components/staff/TopDishRow';
import { ANALYTICS_DATA } from '../../../data/mockData';
import styles from './analytics.module.css';

const PERIODS = ['today', 'week', 'month'];

export default function Analytics() {
  const { t } = useTranslation('analytics');
  const [period, setPeriod] = useState('today');
  const data = ANALYTICS_DATA;
  const maxBar = Math.max(...data.hourlyBars);

  return (
    <StaffShell
      title={`📊 ${t('title')}`}
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
          <button className={styles.exportBtn}>+ {t('exportCsv')}</button>
        </div>
      }
    >
      <div className={styles.page}>
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