'use strict';

const React                  = require('react');
const { Resend }             = require('resend');
const OnboardingConfirmation = require('../../emails/OnboardingConfirmation');
const OnboardingCredentials  = require('../../emails/OnboardingCredentials');
const PasswordResetEmail        = require('../../emails/PasswordReset');
const StaffWelcome              = require('../../emails/StaffWelcome');
const EmailChangeConfirmation   = require('../../emails/EmailChangeConfirmation');
const AccountDeactivated        = require('../../emails/AccountDeactivated');
const AccountActivated          = require('../../emails/AccountActivated');

// ─── Resend client (lazy singleton) ──────────────────────────────────────────

let _resend = null;

function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = () => process.env.EMAIL_FROM || 'QR Restaurant <onboarding@qrrest.app>';

// ─── public API ──────────────────────────────────────────────────────────────

async function sendOnboardingConfirmation({ to, ownerName, restaurantName, confirmUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Підтвердіть реєстрацію ресторану «${restaurantName}» — QR Restaurant`,
    react:   React.createElement(OnboardingConfirmation, { ownerName, restaurantName, confirmUrl }),
  });
  if (error) throw new Error(`Resend error (confirmation): ${error.message}`);
}

async function sendOnboardingCredentials({ to, ownerName, restaurantName, restaurantId, password, loginUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Ваш ресторан «${restaurantName}» готовий — дані для входу`,
    react:   React.createElement(OnboardingCredentials, { ownerName, restaurantName, restaurantId, email: to, password, loginUrl }),
  });
  if (error) throw new Error(`Resend error (credentials): ${error.message}`);
}

/**
 * Send a password-reset link to the user.
 * @param {{ to: string, name: string, resetUrl: string }} opts
 */
async function sendPasswordReset({ to, name, resetUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: 'Скидання пароля — Waitless QR',
    react:   React.createElement(PasswordResetEmail, { name, resetUrl }),
  });
  if (error) throw new Error(`Resend error (password-reset): ${error.message}`);
}

/**
 * Send welcome email to a newly registered staff member with their temporary password.
 * @param {{ to: string, name: string, restaurantName: string, tempPassword: string, role: string, loginUrl: string }} opts
 */
async function sendStaffWelcome({ to, name, restaurantName, tempPassword, role, loginUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Вас додано до ресторану «${restaurantName}» — Waitless QR`,
    react:   React.createElement(StaffWelcome, { name, restaurantName, email: to, tempPassword, role, loginUrl }),
  });
  if (error) throw new Error(`Resend error (staff-welcome): ${error.message}`);
}

/**
 * Send an email-change confirmation link to the new email address.
 * @param {{ to: string, name: string, newEmail: string, confirmUrl: string }} opts
 */
async function sendEmailChangeConfirmation({ to, name, newEmail, confirmUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: 'Підтвердіть нову email-адресу — Waitless QR',
    react:   React.createElement(EmailChangeConfirmation, { name, newEmail, confirmUrl }),
  });
  if (error) throw new Error(`Resend error (email-change): ${error.message}`);
}

/**
 * Notify a staff member that their account has been deactivated.
 * @param {{ to: string, name: string, email: string, restaurantName: string }} opts
 */
async function sendAccountDeactivated({ to, name, email, restaurantName }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: 'Ваш акаунт деактивовано — Waitless QR',
    react:   React.createElement(AccountDeactivated, { name, email, restaurantName }),
  });
  if (error) throw new Error(`Resend error (account-deactivated): ${error.message}`);
}

/**
 * Notify a staff member that their account has been re-activated.
 * @param {{ to: string, name: string, email: string, restaurantName: string, loginUrl: string }} opts
 */
async function sendAccountActivated({ to, name, email, restaurantName, loginUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: 'Ваш акаунт активовано — Waitless QR',
    react:   React.createElement(AccountActivated, { name, email, restaurantName, loginUrl }),
  });
  if (error) throw new Error(`Resend error (account-activated): ${error.message}`);
}

module.exports = {
  sendOnboardingConfirmation,
  sendOnboardingCredentials,
  sendPasswordReset,
  sendStaffWelcome,
  sendEmailChangeConfirmation,
  sendAccountDeactivated,
  sendAccountActivated,
};
