/**
 * tests/email.test.js
 *
 * Unit tests for the email service and both React Email templates.
 * Resend is fully mocked — no real HTTP calls are made.
 * @react-email/render is also mocked — no ESM dynamic-import issues in Jest.
 *
 * Template structure tests verify the React element tree directly (props,
 * component type, nested children).  Actual HTML rendering is covered by
 * tests/integration/email.integration.js which runs outside Jest.
 *
 * Covers:
 *   emailService.sendOnboardingConfirmation
 *     ✓ calls Resend once with correct to / from / subject / react
 *     ✓ react element is of type OnboardingConfirmation
 *     ✓ throws when Resend returns an error
 *
 *   emailService.sendOnboardingCredentials
 *     ✓ calls Resend once with correct to / from / subject / react
 *     ✓ react element is of type OnboardingCredentials
 *     ✓ forwards all credential props to the component
 *     ✓ throws when Resend returns an error
 *
 *   OnboardingConfirmation component
 *     ✓ returns a React element
 *     ✓ receives ownerName / restaurantName / confirmUrl as props
 *
 *   OnboardingCredentials component
 *     ✓ returns a React element
 *     ✓ receives all six credential props
 */

'use strict';

const React = require('react');

// ─── Mock Resend ──────────────────────────────────────────────────────────────

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// ─── Mock @react-email/render (uses ESM dynamic import, incompatible with Jest)

jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html>mocked</html>'),
}));

// ─── Env vars must be set before any service module is required ───────────────

process.env.RESEND_API_KEY = 'test_resend_key';
process.env.EMAIL_FROM     = 'QR Restaurant <onboarding@example.com>';
process.env.BASE_URL       = 'http://localhost:5000';

const emailService           = require('../src/services/emailService');
const OnboardingConfirmation = require('../emails/OnboardingConfirmation');
const OnboardingCredentials  = require('../emails/OnboardingCredentials');

// ─── fixtures ────────────────────────────────────────────────────────────────

const CONFIRMATION_OPTS = {
  to:             'owner@example.com',
  ownerName:      'Іван Франко',
  restaurantName: 'Борщечок',
  confirmUrl:     'http://localhost:5000/api/onboarding/confirm/abc123token',
};

const CREDENTIALS_OPTS = {
  to:             'owner@example.com',
  ownerName:      'Іван Франко',
  restaurantName: 'Борщечок',
  restaurantId:   'BR5CH3OK',
  password:       'Abc123!@#xyz',
  loginUrl:       'http://localhost:3000/login',
};

// ─────────────────────────────────────────────────────────────────────────────
//  emailService.sendOnboardingConfirmation
// ─────────────────────────────────────────────────────────────────────────────

describe('emailService.sendOnboardingConfirmation', () => {
  beforeEach(() => mockSend.mockResolvedValue({ data: { id: 'msg_conf_1' }, error: null }));
  afterEach(() => mockSend.mockReset());

  it('calls resend.emails.send exactly once', async () => {
    await emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('sends to the correct recipient', async () => {
    await emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS);
    expect(mockSend.mock.calls[0][0].to).toBe(CONFIRMATION_OPTS.to);
  });

  it('sends from the configured EMAIL_FROM address', async () => {
    await emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS);
    expect(mockSend.mock.calls[0][0].from).toBe(process.env.EMAIL_FROM);
  });

  it('includes the restaurant name in the subject line', async () => {
    await emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS);
    expect(mockSend.mock.calls[0][0].subject).toContain(CONFIRMATION_OPTS.restaurantName);
  });

  it('passes a React element of type OnboardingConfirmation in the react field', async () => {
    await emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS);
    const { react } = mockSend.mock.calls[0][0];
    expect(react).toBeTruthy();
    expect(react.type).toBe(OnboardingConfirmation);
  });

  it('forwards ownerName, restaurantName and confirmUrl to the component', async () => {
    await emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS);
    const { react } = mockSend.mock.calls[0][0];
    expect(react.props.ownerName).toBe(CONFIRMATION_OPTS.ownerName);
    expect(react.props.restaurantName).toBe(CONFIRMATION_OPTS.restaurantName);
    expect(react.props.confirmUrl).toBe(CONFIRMATION_OPTS.confirmUrl);
  });

  it('throws when Resend returns an error object', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    await expect(
      emailService.sendOnboardingConfirmation(CONFIRMATION_OPTS)
    ).rejects.toThrow('rate limited');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  emailService.sendOnboardingCredentials
// ─────────────────────────────────────────────────────────────────────────────

describe('emailService.sendOnboardingCredentials', () => {
  beforeEach(() => mockSend.mockResolvedValue({ data: { id: 'msg_cred_1' }, error: null }));
  afterEach(() => mockSend.mockReset());

  it('calls resend.emails.send exactly once', async () => {
    await emailService.sendOnboardingCredentials(CREDENTIALS_OPTS);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('sends to the correct recipient', async () => {
    await emailService.sendOnboardingCredentials(CREDENTIALS_OPTS);
    expect(mockSend.mock.calls[0][0].to).toBe(CREDENTIALS_OPTS.to);
  });

  it('includes the restaurant name in the subject line', async () => {
    await emailService.sendOnboardingCredentials(CREDENTIALS_OPTS);
    expect(mockSend.mock.calls[0][0].subject).toContain(CREDENTIALS_OPTS.restaurantName);
  });

  it('passes a React element of type OnboardingCredentials in the react field', async () => {
    await emailService.sendOnboardingCredentials(CREDENTIALS_OPTS);
    const { react } = mockSend.mock.calls[0][0];
    expect(react.type).toBe(OnboardingCredentials);
  });

  it('forwards all six credential props to the component', async () => {
    await emailService.sendOnboardingCredentials(CREDENTIALS_OPTS);
    const { props } = mockSend.mock.calls[0][0].react;
    expect(props.ownerName).toBe(CREDENTIALS_OPTS.ownerName);
    expect(props.restaurantName).toBe(CREDENTIALS_OPTS.restaurantName);
    expect(props.restaurantId).toBe(CREDENTIALS_OPTS.restaurantId);
    expect(props.email).toBe(CREDENTIALS_OPTS.to);           // to → email
    expect(props.password).toBe(CREDENTIALS_OPTS.password);
    expect(props.loginUrl).toBe(CREDENTIALS_OPTS.loginUrl);
  });

  it('throws when Resend returns an error object', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'invalid api key' } });
    await expect(
      emailService.sendOnboardingCredentials(CREDENTIALS_OPTS)
    ).rejects.toThrow('invalid api key');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  OnboardingConfirmation — React element structure
// ─────────────────────────────────────────────────────────────────────────────

describe('OnboardingConfirmation component', () => {
  const PROPS = {
    ownerName:      'Тест Тестович',
    restaurantName: 'Тест Кафе',
    confirmUrl:     'https://example.com/confirm/xyz',
  };

  it('returns a truthy React element', () => {
    const el = React.createElement(OnboardingConfirmation, PROPS);
    expect(el).toBeTruthy();
  });

  it('element type is the OnboardingConfirmation function', () => {
    const el = React.createElement(OnboardingConfirmation, PROPS);
    expect(el.type).toBe(OnboardingConfirmation);
  });

  it('element carries the ownerName prop', () => {
    const el = React.createElement(OnboardingConfirmation, PROPS);
    expect(el.props.ownerName).toBe(PROPS.ownerName);
  });

  it('element carries the restaurantName prop', () => {
    const el = React.createElement(OnboardingConfirmation, PROPS);
    expect(el.props.restaurantName).toBe(PROPS.restaurantName);
  });

  it('element carries the confirmUrl prop', () => {
    const el = React.createElement(OnboardingConfirmation, PROPS);
    expect(el.props.confirmUrl).toBe(PROPS.confirmUrl);
  });

  it('renders without throwing when called directly', () => {
    expect(() => OnboardingConfirmation(PROPS)).not.toThrow();
  });

  it('rendered output is a React element (Html root)', () => {
    const output = OnboardingConfirmation(PROPS);
    expect(output).toBeTruthy();
    expect(typeof output).toBe('object');
    expect(output.type).toBeTruthy(); // Html component
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  OnboardingCredentials — React element structure
// ─────────────────────────────────────────────────────────────────────────────

describe('OnboardingCredentials component', () => {
  const PROPS = {
    ownerName:      'Тест Тестович',
    restaurantName: 'Тест Кафе',
    restaurantId:   'TST12345',
    email:          'test@example.com',
    password:       'SuperSecret99!',
    loginUrl:       'https://example.com/login',
  };

  it('returns a truthy React element', () => {
    const el = React.createElement(OnboardingCredentials, PROPS);
    expect(el).toBeTruthy();
  });

  it('element type is the OnboardingCredentials function', () => {
    const el = React.createElement(OnboardingCredentials, PROPS);
    expect(el.type).toBe(OnboardingCredentials);
  });

  it('element carries all six credential props', () => {
    const el = React.createElement(OnboardingCredentials, PROPS);
    expect(el.props.ownerName).toBe(PROPS.ownerName);
    expect(el.props.restaurantName).toBe(PROPS.restaurantName);
    expect(el.props.restaurantId).toBe(PROPS.restaurantId);
    expect(el.props.email).toBe(PROPS.email);
    expect(el.props.password).toBe(PROPS.password);
    expect(el.props.loginUrl).toBe(PROPS.loginUrl);
  });

  it('renders without throwing when called directly', () => {
    expect(() => OnboardingCredentials(PROPS)).not.toThrow();
  });

  it('rendered output is a React element (Html root)', () => {
    const output = OnboardingCredentials(PROPS);
    expect(output).toBeTruthy();
    expect(typeof output).toBe('object');
    expect(output.type).toBeTruthy();
  });
});
