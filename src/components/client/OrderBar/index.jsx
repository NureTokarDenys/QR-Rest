import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from 'react-i18next';
import { MdReceipt, MdChevronRight } from 'react-icons/md';
import styles from './orderBar.module.css';

const HIDE_ON = ['/staff', '/order-status', '/cart', '/confirm', '/login',
  '/register', '/forgot-password', '/auth/', '/onboarding'];

export default function OrderBar() {
  const { currentOrder } = useApp();
  const { t } = useTranslation('orderStatus');
  const location = useLocation();
  const navigate = useNavigate();

  if (!currentOrder) return null;
  if (HIDE_ON.some(p => location.pathname.startsWith(p))) return null;

  const orderId = currentOrder.id || currentOrder._id;

  return (
    <div
      className={styles.bar}
      onClick={() => navigate(`/order-status/${orderId}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/order-status/${orderId}`)}
    >
      <MdReceipt className={styles.icon} />
      <span className={styles.label}>
        {t('order')} <span className={styles.id}>#{orderId}</span>
      </span>
      <span className={styles.hint}>{t('view_order') ?? 'View order'}</span>
      <MdChevronRight className={styles.chevron} />
    </div>
  );
}
