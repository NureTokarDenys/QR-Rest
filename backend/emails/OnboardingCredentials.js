'use strict';

/**
 * OnboardingCredentials
 * Sent after email confirmation — delivers admin login credentials.
 *
 * Props:
 *   ownerName      {string}
 *   restaurantName {string}
 *   restaurantId   {string}
 *   email          {string}
 *   password       {string}
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
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: token.blue,
    margin: '0 0 32px',
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: token.dark,
    margin: '0 0 16px',
  },
  text: {
    fontSize: 15,
    color: token.dark,
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  // Credential table card
  card: {
    backgroundColor: token.stripe,
    border: `1px solid ${token.border}`,
    borderRadius: 8,
    padding: '20px 24px',
    margin: '20px 0',
  },
  labelCell: {
    fontSize: 13,
    color: token.gray,
    fontWeight: 500,
    paddingBottom: 10,
    width: 140,
    verticalAlign: 'top',
  },
  valueCell: {
    fontSize: 14,
    color: token.dark,
    fontWeight: 700,
    fontFamily: "'Courier New',Courier,monospace",
    paddingBottom: 10,
    verticalAlign: 'top',
    wordBreak: 'break-all',
  },
  warning: {
    fontSize: 13,
    color: token.red,
    fontWeight: 600,
    lineHeight: '20px',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: token.blue,
    borderRadius: 6,
    color: token.white,
    display: 'block',
    fontSize: 15,
    fontWeight: 700,
    padding: '13px 28px',
    textAlign: 'center',
    textDecoration: 'none',
    margin: '28px 0',
  },
  nextHeading: {
    fontSize: 14,
    fontWeight: 700,
    color: token.dark,
    margin: '0 0 8px',
  },
  step: {
    fontSize: 13,
    color: token.dark,
    lineHeight: '22px',
    margin: '0 0 4px',
  },
  hr: { borderColor: token.lightGray, margin: '28px 0' },
  footer: {
    fontSize: 13,
    color: token.gray,
    lineHeight: '20px',
    margin: 0,
  },
};

/** Single row in the credentials card */
function CredRow({ label, value }) {
  return e(Row, null,
    e(Column, { style: styles.labelCell }, label),
    e(Column, { style: styles.valueCell }, value),
  );
}

function OnboardingCredentials({
  ownerName      = '',
  restaurantName = '',
  restaurantId   = '',
  email          = '',
  password       = '',
  loginUrl       = '',
}) {
  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null,
      `Ваш ресторан «${restaurantName}» готовий — дані для входу в систему`
    ),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading },
          'Ваш ресторан готовий! 🎉'
        ),

        e(Text, { style: styles.text },
          `Вітаємо, ${ownerName}! Ресторан `,
          e('strong', null, restaurantName),
          ' успішно зареєстровано. Нижче — ваші дані для першого входу в систему як адміністратор.'
        ),

        // Credentials card
        e(Section, { style: styles.card },
          e(CredRow, { label: 'Email',           value: email }),
          e(CredRow, { label: 'Пароль',          value: password }),
          e(CredRow, { label: 'ID ресторану',    value: restaurantId }),
          e(CredRow, { label: 'Назва',           value: restaurantName }),
        ),

        e(Text, { style: styles.warning },
          '⚠️ Змініть пароль одразу після першого входу в розділі «Налаштування».'
        ),

        e(Section, null,
          e(Button, { href: loginUrl, style: styles.button },
            'Увійти до системи'
          )
        ),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.nextHeading }, 'Що далі?'),
        e(Text, { style: styles.step }, '1. Увійдіть і змініть пароль у розділі «Налаштування».'),
        e(Text, { style: styles.step }, '2. Додайте категорії та страви у розділі «Меню».'),
        e(Text, { style: styles.step }, '3. Роздрукуйте QR-коди для столів — і перші замовлення вже скоро!'),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.footer },
          'Якщо ви не реєстрували ресторан — зверніться до нашої підтримки. ' +
          'Цей лист надіслано автоматично.'
        ),
      )
    )
  );
}

module.exports = OnboardingCredentials;
