// One-off: send the waitlist thank-you email to arkitechcloud@gmail.com so
// Will can eyeball the rendered output before users see it. Run with:
//   node --env-file=.env server/scripts/send-test-waitlist-email.js
//
// Requires RESEND_API_KEY in .env. Safe to re-run (Resend just queues another
// delivery). Does NOT touch the waiting-list table.

import { sendWaitlistThankYouEmail } from '../email.js';

const TEST_RECIPIENT = 'arkitechcloud@gmail.com';

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY in env. Aborting.');
    process.exit(1);
  }
  console.log(`Sending waitlist thank-you to ${TEST_RECIPIENT}...`);
  await sendWaitlistThankYouEmail(TEST_RECIPIENT);
  console.log('Done. Check the inbox.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Send failed:', err);
  process.exit(1);
});
