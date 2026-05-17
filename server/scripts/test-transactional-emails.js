// One-off smoke test: fire password reset, signup notification, and daily
// summary emails with mock data to confirm each path delivers cleanly through
// Resend. Logs the recipient + outcome for each.
//
// Recipients:
//   - Password reset   → willmartinmail@gmail.com (override with arg 1)
//   - Signup notif     → process.env.ADMIN_EMAIL
//   - Daily summary    → process.env.ADMIN_EMAIL
//
// Run: node --env-file=server/.env server/scripts/test-transactional-emails.js [reset-to]
import {
  sendPasswordResetEmail,
  sendNewSignupNotification,
  sendDailySummaryEmail,
} from '../email.js';

const RESET_TO = process.argv[2] || 'willmartinmail@gmail.com';

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY not set. Aborting.');
  process.exit(1);
}
if (!process.env.ADMIN_EMAIL) {
  console.error('ADMIN_EMAIL not set — signup notification + daily summary will silently skip. Aborting.');
  process.exit(1);
}

console.log(`Reset target:  ${RESET_TO}`);
console.log(`Admin target:  ${process.env.ADMIN_EMAIL}`);
console.log('');

// 1. Password reset
console.log('--- Password reset ---');
await sendPasswordResetEmail(RESET_TO, 'test-token-do-not-use-' + Date.now());
console.log('Sent (or logged failure above).');
console.log('');

// 2. Signup notification (goes to ADMIN_EMAIL)
console.log('--- Signup notification ---');
await sendNewSignupNotification(
  {
    firstName: 'Test',
    lastName: 'Reviewer',
    email: 'test-signup@example.com',
    phone: '+15555550100',
    username: 'testreviewer',
    gender: 'Prefer not to say',
    signupDevice: 'iOS Test',
    zipCode: '02115',
    signupCity: 'Boston',
    signupState: 'MA',
    referralSource: 'Email test',
    referralCode: null,
    utmSource: 'test',
    utmMedium: 'transactional-smoke',
    utmCampaign: 'email-pipeline-verify',
  },
  9999
);
console.log('Sent (or logged failure above).');
console.log('');

// 3. Daily summary (goes to ADMIN_EMAIL)
console.log('--- Daily summary ---');
await sendDailySummaryEmail({
  totalUsers: 9999,
  workoutsCurrent: 42,
  workoutsPrev: 38,
  newUsersCurrent: 7,
  newUsersPrev: 5,
  activeUsersCurrent: 23,
  activeUsersPrev: 19,
  recentSignups: [
    { first_name: 'Test', last_name: 'Reviewer', email: 'test-signup@example.com', signup_city: 'Boston', signup_state: 'MA' },
    { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', signup_city: 'Cambridge', signup_state: 'MA' },
  ],
});
console.log('Sent (or logged failure above).');
console.log('');

console.log('Done. Check the inboxes above.');
process.exit(0);
