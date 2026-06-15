'use strict';

/**
 * AccountActivated email template.
 * Sent when an admin activates (restores) a staff member's account.
 *
 * Props:
 *   name           {string}
 *   email          {string}
 *   restaurantName {string}
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
  dark:      '#111827',
  gray:      '#6b7280',
  lightGray: '#e5e7eb',
  bg:        '#f3f4f6',
  white:     '#ffffff',
  stripe:    '#f0fdf4',
  border:    '#bbf7d0',
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
    paddingBottom: 10, verticalAlign: 'top', wordBreak: 'break-all',
  },
  button: {
    backgroundColor: token.blue,
    borderRadius: 6, color: token.white,
    display: 'block', fontSize: 15, fontWeight: 700,
    padding: '13px 28px', textAlign: 'center', textDecoration: 'none', margin: '28px 0',
  },
  hr:     { borderColor: token.lightGray, margin: '28px 0' },
  footer: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: 0 },
};

function InfoRow({ label, value }) {
  return e(Row, null,
    e(Column, { style: styles.labelCell }, label),
    e(Column, { style: styles.valueCell }, value),
  );
}

function AccountActivated({ name = '', email = '', restaurantName = '', loginUrl = '' }) {
  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null, 'Ваш акаунт активовано — Waitless QR'),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading }, 'Акаунт активовано'),

        e(Text, { style: styles.text },
          `Привіт${name ? `, ${name}` : ''}! Ваш акаунт у ресторані `,
          e('strong', null, restaurantName),
          ' було відновлено адміністратором. Ви знову можете входити в систему.'
        ),

        e(Section, { style: styles.card },
          e(InfoRow, { label: "Ім'я",    value: name }),
          e(InfoRow, { label: 'Email',    value: email }),
          e(InfoRow, { label: 'Ресторан', value: restaurantName }),
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

module.exports = AccountActivated;
