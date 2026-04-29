// One-off: send a test email via Resend from the new replab-fitness.com
// domain to confirm DNS + DKIM + sender are all working end-to-end.
//
// Run: node --env-file=server/.env server/scripts/send-test-email.js [to-address]
import { Resend } from 'resend';

const TO = process.argv[2] || 'willmartinmail@gmail.com';
const FROM = 'RepLab <noreply@email.replab-fitness.com>';

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY not set in env.');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

const sentAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

const html = `
<div style="font-family:-apple-system,sans-serif;background:#000;color:#fff;padding:40px 24px;max-width:600px;margin:0 auto;">
  <div style="border-left:3px solid #ef4444;padding-left:16px;margin-bottom:24px;">
    <p style="font-size:11px;color:#ef4444;letter-spacing:0.4em;text-transform:uppercase;margin:0 0 6px;font-weight:700;">RepLab · System Test</p>
    <h1 style="font-size:28px;font-weight:900;color:#fff;margin:0;letter-spacing:-0.02em;line-height:0.95;">DELIVERY OK</h1>
  </div>
  <p style="font-size:14px;color:#bbb;line-height:1.6;margin:0 0 16px;">
    If you're reading this, the new sender domain
    <strong style="color:#fff;">email.replab-fitness.com</strong> is verified in Resend
    and DKIM/SPF/DMARC are signing cleanly.
  </p>
  <p style="font-size:13px;color:#888;margin:0 0 6px;"><strong style="color:#fff;">From:</strong> ${FROM}</p>
  <p style="font-size:13px;color:#888;margin:0 0 6px;"><strong style="color:#fff;">To:</strong> ${TO}</p>
  <p style="font-size:13px;color:#888;margin:0 0 24px;"><strong style="color:#fff;">Sent:</strong> ${sentAt} ET</p>
  <p style="font-size:11px;color:#555;border-top:1px solid #222;padding-top:14px;margin:0;">
    Sent via <code style="color:#888;">server/scripts/send-test-email.js</code> against the live Render Postgres environment. No DB writes; safe to ignore.
  </p>
</div>
`;

const text = `RepLab — System Test
DELIVERY OK

If you're reading this, the new sender domain email.replab-fitness.com is verified in Resend and DKIM/SPF/DMARC are signing cleanly.

From: ${FROM}
To:   ${TO}
Sent: ${sentAt} ET

Sent via server/scripts/send-test-email.js. No DB writes.`;

console.log(`Sending test email from ${FROM} to ${TO}...`);

const { data, error } = await resend.emails.send({
  from: FROM,
  to: TO,
  subject: 'RepLab — DELIVERY OK (Resend test from replab-fitness.com)',
  html,
  text,
});

if (error) {
  console.error('FAIL:', error);
  process.exit(1);
}

console.log('OK. Resend message id:', data?.id);
console.log('Check inbox (and spam folder if it doesn\'t arrive in 30s).');
