'use strict';

/**
 * EmailChangeConfirmation
 * Sent to the NEW email address when a user requests an email change.
 *
 * Props:
 *   name       {string} — user's display name
 *   newEmail   {string} — the new address (so user can verify it's correct)
 *   confirmUrl {string} — one-time confirmation link (valid 1 hour)
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
  green:     '#16a34a',
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
  highlight: {
    display: 'inline-block',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    padding: '6px 12px',
    fontFamily: "'Courier New',Courier,monospace",
    fontSize: 15,
    fontWeight: 700,
    color: token.green,
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
  note: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: '0 0 16px' },
  hr:   { borderColor: token.lightGray, margin: '28px 0' },
  footer: { fontSize: 13, color: token.gray, lineHeight: '20px', margin: 0 },
};

function EmailChangeConfirmation({ name = '', newEmail = '', confirmUrl = '' }) {
  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null, 'Підтвердіть нову email-адресу — Waitless QR'),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading }, 'Підтвердіть нову email-адресу'),

        e(Text, { style: styles.text },
          `Привіт${name ? `, ${name}` : ''}! Ви запросили зміну email-адреси вашого акаунта на:`
        ),

        e(Text, { style: styles.highlight }, newEmail),

        e(Text, { style: styles.text },
          'Натисніть кнопку нижче, щоб підтвердити цю адресу. Посилання дійсне протягом ',
          e('strong', null, '1 години'),
          '.'
        ),

        e(Button, { href: confirmUrl, style: styles.button }, 'Підтвердити email'),

        e(Text, { style: styles.note },
          'Якщо ви не запитували зміну email — проігноруйте цей лист. ' +
          'Ваша поточна адреса залишиться незмінною.'
        ),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.footer },
          'Цей лист надіслано автоматично. Будь ласка, не відповідайте на нього.'
        ),
      )
    )
  );
}

module.exports = EmailChangeConfirmation;
