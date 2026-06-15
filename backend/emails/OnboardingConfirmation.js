'use strict';

/**
 * OnboardingConfirmation
 * Sent when a restaurant owner submits the registration form.
 *
 * Props:
 *   ownerName      {string}
 *   restaurantName {string}
 *   confirmUrl     {string}
 */

const React = require('react');
const {
  Html, Head, Body, Container, Section,
  Heading, Text, Button, Hr, Preview,
} = require('@react-email/components');

const e = React.createElement;

const token = {
  blue:       '#2563eb',
  dark:       '#111827',
  gray:       '#6b7280',
  lightGray:  '#e5e7eb',
  bg:         '#f3f4f6',
  white:      '#ffffff',
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
  highlight: {
    fontWeight: 700,
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
  hr: { borderColor: token.lightGray, margin: '28px 0' },
  fallbackLabel: {
    fontSize: 13,
    color: token.gray,
    lineHeight: '20px',
    margin: '0 0 4px',
  },
  fallbackUrl: {
    fontSize: 12,
    color: token.gray,
    wordBreak: 'break-all',
    margin: '0 0 28px',
  },
  footer: {
    fontSize: 13,
    color: token.gray,
    lineHeight: '20px',
    margin: 0,
  },
};

function OnboardingConfirmation({ ownerName = '', restaurantName = '', confirmUrl = '' }) {
  return e(Html, { lang: 'uk' },
    e(Head),
    e(Preview, null,
      `Підтвердіть реєстрацію ресторану «${restaurantName}» Waitless QR`
    ),
    e(Body, { style: styles.body },
      e(Container, { style: styles.container },

        e(Text, { style: styles.brand }, 'Waitless QR'),

        e(Heading, { as: 'h2', style: styles.heading },
          `Вітаємо, ${ownerName}!`
        ),

        e(Text, { style: styles.text },
          'Ви подали заявку на підключення ресторану ',
          e('strong', { style: styles.highlight }, restaurantName),
          ' до платформи QR Restaurant. Будь ласка, підтвердіть вашу електронну адресу, щоб ми могли створити ваш обліковий запис.'
        ),

        e(Text, { style: styles.text },
          'Посилання для підтвердження дійсне ', e('strong', null, '24 години'), '.'
        ),

        e(Section, null,
          e(Button, { href: confirmUrl, style: styles.button },
            'Підтвердити реєстрацію'
          )
        ),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.fallbackLabel },
          'Якщо кнопка не працює, скопіюйте це посилання у браузер:'
        ),
        e(Text, { style: styles.fallbackUrl }, confirmUrl),

        e(Hr, { style: styles.hr }),

        e(Text, { style: styles.footer },
          'Якщо ви не реєстрували ресторан — просто проігноруйте цей лист. ' +
          'Жодних дій не потрібно.'
        ),
      )
    )
  );
}

module.exports = OnboardingConfirmation;
