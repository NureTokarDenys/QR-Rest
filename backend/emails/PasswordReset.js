'use strict';

/**
 * PasswordReset email template.
 * Sent when a user requests a password reset link.
 *
 * Props:
 *   name     {string} — user's display name
 *   resetUrl {string} — one-time reset link (valid 1 hour)
 */

const React = require('react');
const {
  Html, Head, Body, Container,
  Heading, Text, Button, Hr, Preview,
} = require('@react-email/components');

const e = React.createElement;

const token = {
  blue:      '#2563eb',
  dark:      '#111827',
  gray:      '#6b7280',
  lightGray: '#e5e7eb',
  bg:        '#f3f4f6',
  white:     '#ffffff',
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
  brand: { fontSize: 20, fontWeight: 700, color: token.blue, margin: '0 0 32px' },
  heading: { fontSize: 22, fontWeight: 700, color: token.dark, margin: '0 0 16px' },
  text: { fontSize: 15, color: token.dark, lineHeight: '24px', margin: '0 0 16px' },
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
  note: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: '0 0 16px' },
  hr: { borderColor: token.lightGray, margin: '28px 0' },
  footer: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: 0 },
};

function PasswordResetEmail({ name = '', resetUrl = '' }) {
  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null, 'Скидання пароля — Waitless QR'),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading }, 'Скидання пароля'),

        e(Text, { style: styles.text },
          `Привіт${name ? `, ${name}` : ''}! Ми отримали запит на скидання пароля для вашого акаунта.`
        ),

        e(Text, { style: styles.text },
          'Натисніть кнопку нижче, щоб встановити новий пароль. Посилання дійсне протягом ',
          e('strong', null, '1 години'),
          '.'
        ),

        e(Button, { href: resetUrl, style: styles.button }, 'Скинути пароль'),

        e(Text, { style: styles.note },
          'Якщо ви не запитували скидання пароля — просто проігноруйте цей лист. ' +
          'Ваш пароль залишиться незмінним.'
        ),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.footer },
          'Цей лист надіслано автоматично. Будь ласка, не відповідайте на нього.'
        ),
      )
    )
  );
}

module.exports = PasswordResetEmail;
