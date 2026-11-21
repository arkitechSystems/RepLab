// Request-body schemas for routes/auth.js (see validation.js for the approach).
//
// Sign-in and sign-up are the riskiest routes to tighten, so these only check
// that each field that is sent has the right type and a sane length — the
// handlers keep their "is required" / password-rule / plan messages exactly
// as before. What this adds: a number or object where text belongs is a 400
// naming the field, instead of a crash (500) or a mangled value in the
// database. Limits are generous on purpose.
//
// Deliberately not validated here:
// - POST /auth/request-deletion — answers { ok: true } to any input so it
//   never reveals whether an email exists.
// - PUT /auth/profile-photo and POST /auth/page-visit — their handlers
//   already check type, format and size with their own messages.

import { z } from 'zod';
import { optionalText, optionalTextish } from '../validation.js';

const NAME = 200;
const PASSWORD = 200; // bcrypt only uses the first 72 bytes; this just stops abuse
const EMAIL_OR_PHONE = 320;
const TOKEN = 10000; // Firebase ID tokens are ~1–2 KB
const SHORT = 100;
const FIELD = 1000;

const utm = {
  utmSource: optionalText(FIELD),
  utmMedium: optionalText(FIELD),
  utmCampaign: optionalText(FIELD),
  utmContent: optionalText(FIELD),
  utmTerm: optionalText(FIELD),
};

export const signupBody = z.looseObject({
  identifier: optionalText(EMAIL_OR_PHONE),
  password: optionalText(PASSWORD),
  firstName: optionalText(NAME),
  lastName: optionalText(NAME),
  phone: optionalTextish(SHORT),
  gender: optionalText(SHORT),
  username: optionalText(SHORT),
  referralSource: optionalText(FIELD),
  referralCode: optionalText(NAME),
  zipCode: optionalTextish(SHORT),
  timezone: optionalText(SHORT),
  ...utm,
  deviceInfo: z.unknown().optional(),
});

export const loginBody = z.looseObject({
  identifier: optionalText(EMAIL_OR_PHONE),
  password: optionalText(PASSWORD),
});

export const socialBody = z.looseObject({
  idToken: optionalText(TOKEN),
  firstName: optionalText(NAME),
  lastName: optionalText(NAME),
  referralCode: optionalText(NAME),
  timezone: optionalText(SHORT),
  ...utm,
  deviceInfo: z.unknown().optional(),
});

export const socialLinkBody = z.looseObject({
  linkToken: optionalText(TOKEN),
  password: optionalText(PASSWORD),
});

export const signupProfileBody = z.looseObject({
  firstName: optionalText(NAME),
  lastName: optionalText(NAME),
  zipCode: optionalTextish(SHORT),
  gender: optionalText(SHORT),
  referralSource: optionalText(FIELD),
  referralCode: optionalText(NAME),
  phone: optionalTextish(SHORT),
});

export const refreshBody = z.looseObject({ refreshToken: optionalText(TOKEN) });

export const requestResetBody = z.looseObject({ email: optionalText(EMAIL_OR_PHONE) });

export const resetPasswordBody = z.looseObject({
  token: optionalText(TOKEN),
  password: optionalText(PASSWORD),
});

export const changePasswordBody = z.looseObject({
  currentPassword: optionalText(PASSWORD),
  newPassword: optionalText(PASSWORD),
});

export const setPasswordBody = z.looseObject({ password: optionalText(PASSWORD) });

export const planBody = z.looseObject({
  plan: optionalText(SHORT),
  billing: optionalText(SHORT),
});

export const applyTrainerBody = z.looseObject({ message: optionalText(5000) });

export const deleteAccountBody = z.looseObject({
  password: optionalText(PASSWORD),
  idToken: optionalText(TOKEN),
});
