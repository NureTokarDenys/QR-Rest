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

class EmailSendError extends Error {
  constructor(message, { resendStatus } = {}) {
    super(message);
    this.name = 'EmailSendError';
    this.status = 503;
    this.code = 'EMAIL_SEND_FAILED';
    this.resendStatus = resendStatus;
  }
}

function throwIfResendError(error, context) {
  if (!error) return;
  throw new EmailSendError(`Resend error (${context}): ${error.message}`, {
    resendStatus: error.statusCode,
  });
}

// ─── public API ──────────────────────────────────────────────────────────────

async function sendOnboardingConfirmation({ to, ownerName, restaurantName, confirmUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Підтвердіть реєстрацію ресторану «${restaurantName}» — QR Restaurant`,
    react:   React.createElement(OnboardingConfirmation, { ownerName, restaurantName, confirmUrl }),
  });
  throwIfResendError(error, 'confirmation');
}

async function sendOnboardingCredentials({ to, ownerName, restaurantName, restaurantId, password, loginUrl }) {
  const { error } = await getResend().emails.send({
    from:    FROM(),
    to,
    subject: `Ваш ресторан «${restaurantName}» готовий — дані для входу`,
    react:   React.createElement(OnboardingCredentials, { ownerName, restaurantName, restaurantId, email: to, password, loginUrl }),
  });
  throwIfResendError(error, 'credentials');
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
  throwIfResendError(error, 'password-reset');
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
  throwIfResendError(error, 'staff-welcome');
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
  throwIfResendError(error, 'email-change');
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
  throwIfResendError(error, 'account-deactivated');
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
  throwIfResendError(error, 'account-activated');
}

module.exports = {
  EmailSendError,
  sendOnboardingConfirmation,
  sendOnboardingCredentials,
  sendPasswordReset,
  sendStaffWelcome,
  sendEmailChangeConfirmation,
  sendAccountDeactivated,
  sendAccountActivated,
};
