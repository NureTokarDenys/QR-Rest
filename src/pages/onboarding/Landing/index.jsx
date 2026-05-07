import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../../components/Logo';
import styles from './landing.module.css';

import {
  MdQrCode2,
  MdRestaurantMenu,
  MdCheckCircle,
  MdPayment,
  MdKitchen,
  MdPerson,
  MdBarChart,
  MdGroups,
  MdMenu,
  MdClose,
  MdPictureAsPdf,
  MdStar,
} from 'react-icons/md';

// ── SRS 2.2 — Product Features (condensed to 6 cards) ────────────────────────
const FEATURES = [
  {
    icon:  <MdQrCode2 />,
    title: "Smart QR та Session Recovery",
    desc:  "Унікальний QR-код на кожен столик. Повторне сканування повертає збережену сесію з кошиком — без перезавантаження та без встановлення додатку.",
  },
  {
    icon:  <MdKitchen />,
    title: "Кухонна панель (KDS)",
    desc:  "Order View та Table View. Статуси страв у реальному часі через WebSocket: Очікує → Готується → Готово. Стоп-лист без перезавантаження.",
  },
  {
    icon:  <MdPayment />,
    title: "Онлайн-оплата LiqPay",
    desc:  "Індивідуальна оплата або Master Pay — єдиний платіж за весь столик. Пост-пей модель: замовлення — зараз, оплата — після отримання страв.",
  },
  {
    icon:  <MdGroups />,
    title: "Групи подачі",
    desc:  "Гість об'єднує страви у блоки для одночасного приготування та подачі. Кожна група — монолітний блок на кухні з єдиним статусом.",
  },
  {
    icon:  <MdPerson />,
    title: "Офіціантська панель",
    desc:  "Карта залу з кольоровими статусами столиків, виклики гостей, закриття чеків (готівка / Void / walk-out) — все в одному інтерфейсі.",
  },
  {
    icon:  <MdBarChart />,
    title: "Аналітика та PDF-меню",
    desc:  "Дашборд виторгу, журнал замовлень, аудит-лог операцій. Генератор PDF-меню для фізичного друку безпосередньо з адмін-панелі.",
  },
];

// ── SRS 3.14.2 — Onboarding steps ────────────────────────────────────────────
const STEPS = [
  {
    icon:  <MdQrCode2 />,
    n:     "1",
    title: "Реєстрація",
    desc:  "Введіть email, ваше ім'я та назву ресторану. Акаунт адміністратора і ресторан створюються миттєво.",
  },
  {
    icon:  <MdRestaurantMenu />,
    n:     "2",
    title: "Налаштування",
    desc:  "Додайте столики з QR-кодами, заповніть меню: категорії, страви, інгредієнти, add-ons та ComponentGroups.",
  },
  {
    icon:  <MdCheckCircle />,
    n:     "3",
    title: "Запуск",
    desc:  "Гості сканують QR зі смартфона і замовляють самостійно. Кухня та офіціант отримують замовлення в реальному часі.",
  },
];

// ── Pricing tiers ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    badge:    "Стартовий",
    price:    "Безкоштовно",
    sub:      "Без кредитної карти",
    featured: false,
    items: [
      "До 5 столиків",
      "До 200 позицій меню",
      "QR-коди + Smart Session Recovery",
      "Кухонна панель (KDS)",
      "Офіціантська панель + виклик",
      "Управління персоналом",
    ],
    cta: "Почати безкоштовно",
  },
  {
    badge:    "Pro",
    price:    "799 грн",
    sub:      "на місяць",
    featured: true,
    items: [
      "До 200 столиків",
      "До 1 000 позицій меню",
      "Все зі Стартового, плюс:",
      "Онлайн-оплата LiqPay + Master Pay",
      "Аналітичний дашборд (до 90 днів)",
      "Генератор PDF-меню",
      "Система відгуків та рейтингів",
      "Google OAuth для гостей",
    ],
    cta: "Спробувати Pro",
  },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.page}>

      {/* ── Navbar ── */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/landing" className={styles.navLogo}>
            <Logo compact />
          </Link>

          <nav className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}>
            <Link to="/login"      className={styles.navLink} onClick={() => setMenuOpen(false)}>Вхід</Link>
            <Link to="/onboarding" className={styles.navCta}  onClick={() => setMenuOpen(false)}>Спробувати безкоштовно</Link>
          </nav>

          <button className={styles.burger} onClick={() => setMenuOpen(v => !v)} aria-label="Меню">
            {menuOpen ? <MdClose /> : <MdMenu />}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>
            Цифрове меню та безконтактні замовлення для вашого ресторану
          </h1>
          <p className={styles.heroSub}>
            Гість сканує QR на столі зі свого смартфона — без додатку, без черг, без офіціанта для прийому замовлень.
            Кухня, офіціант і адміністратор бачать усе в реальному часі.
          </p>
          <div className={styles.heroBtns}>
            <Link to="/onboarding" className={styles.btnPrimary}>Підключити ресторан</Link>
            <a href="#how-it-works" className={styles.btnSecondary}>Як це працює ↓</a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.phoneMock}>
            <MdQrCode2 className={styles.phoneMockQr} />
            <p className={styles.phoneMockLabel}>Скануйте QR — і вже в меню</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Як це працює</h2>
          <p className={styles.sectionSub}>Три кроки від реєстрації до першого замовлення</p>
          <div className={styles.stepsRow}>
            {STEPS.map(s => (
              <div key={s.n} className={styles.stepCard}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepIcon}>{s.icon}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Можливості платформи</h2>
          <p className={styles.sectionSub}>Повний стек інструментів для сучасного ресторану</p>
          <div className={styles.featuresGrid}>
            {FEATURES.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Тарифи</h2>
          <p className={styles.sectionSub}>Починайте безкоштовно — оновіться коли будете готові</p>
          <div className={styles.pricingRow}>
            {PLANS.map(plan => (
              <div
                key={plan.badge}
                className={`${styles.pricingCard} ${plan.featured ? styles.pricingCardFeatured : ''}`}
              >
                {plan.featured && <div className={styles.pricingPopular}>Найпопулярніший</div>}
                <div className={styles.pricingBadge}>{plan.badge}</div>
                <div className={styles.pricingPrice}>{plan.price}</div>
                <div className={styles.pricingSub}>{plan.sub}</div>
                <ul className={styles.pricingList}>
                  {plan.items.map(item => (
                    <li key={item} className={item.endsWith(':') ? styles.pricingListSeparator : ''}>
                      {item.endsWith(':') ? item : <><span className={styles.checkmark}>✓</span>{item}</>}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/onboarding"
                  className={plan.featured ? styles.btnPrimary : styles.btnOutline}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <Logo compact />
            <p className={styles.footerTagline}>
              Безконтактне замовлення їжі для ресторанів
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Політика конфіденційності</a>
            <a href="#" className={styles.footerLink}>Умови використання</a>
            <Link to="/login"      className={styles.footerLink}>Вхід</Link>
            <Link to="/onboarding" className={styles.footerLink}>Реєстрація</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p className={styles.copyright}>© 2026 Waitless · QR Restaurant System</p>
        </div>
      </footer>

    </div>
  );
}
