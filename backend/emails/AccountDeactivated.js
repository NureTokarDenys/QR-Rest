'use strict';

/**
 * AccountDeactivated email template.
 * Sent when an admin deactivates a staff member's account.
 *
 * Props:
 *   name           {string}
 *   email          {string}
 *   restaurantName {string}
 */

const React = require('react');
const {
  Html, Head, Body, Container, Section,
  Heading, Text, Hr, Preview, Row, Column,
} = require('@react-email/components');

const e = React.createElement;

const token = {
  orange:    '#ea580c',
  dark:      '#111827',
  gray:      '#6b7280',
  lightGray: '#e5e7eb',
  bg:        '#f3f4f6',
  white:     '#ffffff',
  stripe:    '#fff7ed',
  border:    '#fed7aa',
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
  brand:   { fontSize: 20, fontWeight: 700, color: token.orange, margin: '0 0 32px' },
  heading: { fontSize: 22, fontWeight: 700, color: token.dark,   margin: '0 0 16px' },
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
  hr:     { borderColor: token.lightGray, margin: '28px 0' },
  footer: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: 0 },
};

function InfoRow({ label, value }) {
  return e(Row, null,
    e(Column, { style: styles.labelCell }, label),
    e(Column, { style: styles.valueCell }, value),
  );
}

function AccountDeactivated({ name = '', email = '', restaurantName = '' }) {
  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null, 'Ваш акаунт деактивовано — Waitless QR'),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading }, 'Акаунт деактивовано'),

        e(Text, { style: styles.text },
          `Привіт${name ? `, ${name}` : ''}! Ваш акаунт у ресторані `,
          e('strong', null, restaurantName),
          ' було деактивовано адміністратором. Доступ до системи тимчасово заблоковано.'
        ),

        e(Section, { style: styles.card },
          e(InfoRow, { label: "Ім'я",    value: name }),
          e(InfoRow, { label: 'Email',    value: email }),
          e(InfoRow, { label: 'Ресторан', value: restaurantName }),
        ),

        e(Text, { style: styles.text },
          'Щоб відновити доступ, зверніться до адміністратора ресторану.'
        ),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.footer },
          'Цей лист надіслано автоматично. Будь ласка, не відповідайте на нього.'
        ),
      )
    )
  );
}

module.exports = AccountDeactivated;
