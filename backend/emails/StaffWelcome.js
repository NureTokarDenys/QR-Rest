'use strict';

/**
 * StaffWelcome email template.
 * Sent when an admin creates a new employee account.
 *
 * Props:
 *   name           {string} — employee's display name
 *   restaurantName {string}
 *   email          {string} — login email
 *   tempPassword   {string} — generated temporary password
 *   role           {string} — cook | waiter | waiter_cook | admin
 *   loginUrl       {string}
 */

const React = require('react');
const {
  Html, Head, Body, Container, Section,
  Heading, Text, Button, Hr, Preview, Row, Column,
} = require('@react-email/components');

const e = React.createElement;

const token = {
  blue:      '#2563eb',
  red:       '#dc2626',
  dark:      '#111827',
  gray:      '#6b7280',
  lightGray: '#e5e7eb',
  bg:        '#f3f4f6',
  white:     '#ffffff',
  stripe:    '#f9fafb',
  border:    '#e5e7eb',
};

const styles = {
  body: {
    backgroundColor: token.bg,
    fontFamily: "'Inter','Segoe UI',Helvetica,Arial,sans-serif",
    margin: 0,
  },
  container: {
    backgroundColor: token.white,
    borderRadius: 8,
    margin: '40px auto',
    padding: '40px 48px',
    maxWidth: 560,
  },
  brand:   { fontSize: 20, fontWeight: 700, color: token.blue, margin: '0 0 32px' },
  heading: { fontSize: 22, fontWeight: 700, color: token.dark, margin: '0 0 16px' },
  text:    { fontSize: 15, color: token.dark, lineHeight: '24px', margin: '0 0 16px' },
  card: {
    backgroundColor: token.stripe,
    border: `1px solid ${token.border}`,
    borderRadius: 8,
    padding: '20px 24px',
    margin: '20px 0',
  },
  labelCell: {
    fontSize: 13, color: token.gray, fontWeight: 500,
    paddingBottom: 10, width: 120, verticalAlign: 'top',
  },
  valueCell: {
    fontSize: 14, color: token.dark, fontWeight: 700,
    fontFamily: "'Courier New',Courier,monospace",
    paddingBottom: 10, verticalAlign: 'top', wordBreak: 'break-all',
  },
  warning: { fontSize: 13, color: token.red, fontWeight: 600, lineHeight: '20px', margin: '0 0 20px' },
  button: {
    backgroundColor: token.blue,
    borderRadius: 6, color: token.white,
    display: 'block', fontSize: 15, fontWeight: 700,
    padding: '13px 28px', textAlign: 'center', textDecoration: 'none', margin: '28px 0',
  },
  hr:     { borderColor: token.lightGray, margin: '28px 0' },
  footer: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: 0 },
};

const ROLE_LABELS = {
  admin:       'Адміністратор',
  waiter:      'Офіціант',
  cook:        'Кухар',
  waiter_cook: 'Офіціант і кухар',
};

function CredRow({ label, value }) {
  return e(Row, null,
    e(Column, { style: styles.labelCell }, label),
    e(Column, { style: styles.valueCell }, value),
  );
}

function StaffWelcome({
  name           = '',
  restaurantName = '',
  email          = '',
  tempPassword   = '',
  role           = '',
  loginUrl       = '',
}) {
  const roleLabel = ROLE_LABELS[role] || role;

  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null, `Вас додано до ресторану «${restaurantName}» — Waitless QR`),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading },
          `Вас додано до ресторану «${restaurantName}»`
        ),

        e(Text, { style: styles.text },
          `Вітаємо, ${name}! Вас зареєстровано як співробітника ресторану `,
          e('strong', null, restaurantName),
          '. Нижче — ваші дані для першого входу в систему.'
        ),

        e(Section, { style: styles.card },
          e(CredRow, { label: 'Email',   value: email }),
          e(CredRow, { label: 'Пароль',  value: tempPassword }),
          e(CredRow, { label: 'Роль',    value: roleLabel }),
          e(CredRow, { label: 'Ресторан', value: restaurantName }),
        ),

        e(Text, { style: styles.warning },
          '⚠️ Це тимчасовий пароль. Змініть його одразу після першого входу в розділі «Налаштування».'
        ),

        e(Button, { href: loginUrl, style: styles.button }, 'Увійти до системи'),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.footer },
          'Якщо ви не очікували цього листа — зверніться до адміністратора ресторану. ' +
          'Цей лист надіслано автоматично.'
        ),
      )
    )
  );
}

module.exports = StaffWelcome;
