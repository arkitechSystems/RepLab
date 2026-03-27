import { Resend } from 'resend';
import pool from './dbPool.js';

async function getTemplate(name) {
  try {
    const { rows } = await pool.query('SELECT subject, html FROM email_templates WHERE name = $1', [name]);
    return rows[0] || null;
  } catch { return null; }
}

export async function sendWelcomeEmail(email) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const custom = await getTemplate('welcome');

  const defaultSubject = 'Welcome to WillFit — You\'re In!';
  const defaultHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #333;">
          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 32px; font-weight: 900; letter-spacing: 2px; margin: 0; color: #111;">WILL<span style="color: #EF4444;">FIT</span></h1>
          </div>

          <h2 style="color: #111; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">Welcome to WillFit!</h2>
          <p style="font-size: 16px; line-height: 1.7; margin: 0 0 24px 0; color: #444;">
            Thanks for signing up! You're now part of the <strong>alpha version</strong> of WillFit. The app is fully functional and ready for you to start tracking your workouts, but we're still actively building and improving it. Your experience and feedback will help shape the final product.
          </p>

          <!-- Getting Started -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">Getting Started</h3>
          <div style="background: #f0f7ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              <strong>New here? Take the tutorial.</strong> When you open the app, tap the <strong>Tutorial</strong> card on the Workouts page. It'll walk you step by step through picking a program, scheduling it to your calendar, and logging your first workout.
            </p>
          </div>

          <!-- Trainer Dashboard -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">Trainer Dashboard</h3>
          <div style="background: #f8f8f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              <strong>Prefer a bigger screen?</strong> You can create and manage your workouts from a computer using the <a href="https://will-fit.shop/trainer" style="color: #EF4444; text-decoration: none; font-weight: 600;">Trainer Dashboard</a>. Just log in with the same credentials you used to sign up. Everything stays in sync with the app.
            </p>
          </div>

          <!-- AI-Powered Features -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">AI-Powered Features</h3>
          <div style="background: #f0f0ff; border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              We're working on <strong>AI-powered features</strong> for WillFit. Soon you'll be able to generate custom workouts tailored to your goals, experience level, and available equipment — powered by an <strong>AI trainer</strong> built right into the app. Stay tuned.
            </p>
          </div>

          <!-- Alpha Version -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">Alpha Version</h3>
          <div style="padding: 16px 20px; background: #f8f4e8; border-left: 4px solid #e6a817; border-radius: 8px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 13px; line-height: 1.7; margin: 0;">
              <strong>This is an alpha release.</strong> You may encounter occasional bugs or rough edges as we continue to develop the app. New features are being added regularly. If you run into anything or have ideas for improvement, head to <strong>Profile > Send Feedback</strong> — it goes directly to the dev team.
            </p>
          </div>

          <!-- User Guide -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">User Guide</h3>
          <div style="background: #f0f0f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              For a deeper look at every feature, check out the <a href="https://will-fit.shop/trainer/guide" style="color: #EF4444; text-decoration: none; font-weight: 600;">WillFit User Guide</a>. It covers the workout library, calendar, logging sessions, personal records, creating custom workouts, and more.
            </p>
          </div>

          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            Thanks for being an early adopter. We're glad to have you.
          </p>

          <a href="https://will-fit.shop"
             style="display: inline-block; margin-top: 24px; padding: 14px 32px; background: #111; color: #fff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
            Open WillFit
          </a>

          <p style="color: #999; font-size: 12px; margin-top: 24px; line-height: 1.6;">
            If you didn't create a WillFit account, you can safely ignore this email.
          </p>
        </div>
      `;

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@email.will-fit.shop>',
      to: email,
      subject: custom?.subject || defaultSubject,
      html: custom?.html || defaultHtml,
    });
  } catch (err) {
    // Don't fail signup if email sending fails
    console.error('Failed to send welcome email:', err.message);
  }
}

export async function sendPasswordResetEmail(email, token) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping reset email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const resetUrl = `https://will-fit.shop/reset-password/${token}`;

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@email.will-fit.shop>',
      to: email,
      subject: 'Reset your WillFit password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 28px; margin-bottom: 8px;">Reset Your Password</h1>
          <p style="color: #444; font-size: 16px; line-height: 1.6;">
            We received a request to reset your WillFit password. Click the button below to set a new one.
            This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
             style="display: inline-block; margin-top: 24px; padding: 14px 28px;
                    background: #111; color: #fff; text-decoration: none;
                    border-radius: 8px; font-size: 16px; font-weight: 600;">
            Reset Password
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px;">
            If you didn't request this, you can safely ignore this email. Your password won't change.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send reset email:', err.message);
  }
}

export async function sendNewSignupNotification(user, totalUsers) {
  if (!process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'No name provided';

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@email.will-fit.shop>',
      to: process.env.ADMIN_EMAIL,
      subject: `New WillFit Signup — ${name} (#${totalUsers})`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 24px; margin-bottom: 16px;">New User Signup</h1>

          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #888; width: 110px;">Name</td><td style="padding: 6px 0; font-weight: 600;">${name}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Email</td><td style="padding: 6px 0;">${user.email || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Phone</td><td style="padding: 6px 0;">${user.phone || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Username</td><td style="padding: 6px 0;">${user.username || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Gender</td><td style="padding: 6px 0;">${user.gender || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Device</td><td style="padding: 6px 0;">${user.signupDevice || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Zip Code</td><td style="padding: 6px 0;">${user.zipCode || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Location</td><td style="padding: 6px 0;">${[user.signupCity, user.signupState].filter(Boolean).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Referral</td><td style="padding: 6px 0;">${user.referralSource || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Referral Code</td><td style="padding: 6px 0;">${user.referralCode || '—'}</td></tr>
              ${user.utmSource ? `<tr><td style="padding: 6px 0; color: #888;">UTM Source</td><td style="padding: 6px 0;">${user.utmSource}</td></tr>` : ''}
              ${user.utmMedium ? `<tr><td style="padding: 6px 0; color: #888;">UTM Medium</td><td style="padding: 6px 0;">${user.utmMedium}</td></tr>` : ''}
              ${user.utmCampaign ? `<tr><td style="padding: 6px 0; color: #888;">UTM Campaign</td><td style="padding: 6px 0;">${user.utmCampaign}</td></tr>` : ''}
            </table>
          </div>

          <div style="background: #111; color: #fff; border-radius: 12px; padding: 20px; text-align: center;">
            <div style="font-size: 36px; font-weight: 900;">${totalUsers}</div>
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-top: 4px;">Total Users</div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send signup notification:', err.message);
  }
}

export async function sendDailySummaryEmail(stats) {
  if (!process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  function delta(current, previous) {
    const diff = current - previous;
    if (diff > 0) return `<span style="color: #22c55e; font-weight: 700;">+${diff} &#9650;</span>`;
    if (diff < 0) return `<span style="color: #ef4444; font-weight: 700;">${diff} &#9660;</span>`;
    return `<span style="color: #888;">0 &#8212;</span>`;
  }

  const signupRows = stats.recentSignups.map((u) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
    const loc = [u.signup_city, u.signup_state].filter(Boolean).join(', ') || '—';
    return `<tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${name}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${u.email || u.phone || '—'}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${loc}</td>
    </tr>`;
  }).join('');

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@email.will-fit.shop>',
      to: process.env.ADMIN_EMAIL,
      subject: `WillFit Daily Summary — ${stats.totalUsers} users`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 24px; margin-bottom: 4px;">Daily Summary</h1>
          <p style="color: #888; font-size: 13px; margin-bottom: 24px;">${today}</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 16px; background: #111; color: #fff; border-radius: 12px 0 0 0; text-align: center; width: 33%;">
                <div style="font-size: 28px; font-weight: 900;">${stats.totalUsers}</div>
                <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-top: 4px;">Total Users</div>
              </td>
              <td style="padding: 16px; background: #111; color: #fff; text-align: center; width: 33%;">
                <div style="font-size: 28px; font-weight: 900;">${stats.workoutsCurrent}</div>
                <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-top: 4px;">Workouts Today</div>
              </td>
              <td style="padding: 16px; background: #111; color: #fff; border-radius: 0 12px 0 0; text-align: center; width: 33%;">
                <div style="font-size: 28px; font-weight: 900;">${stats.activeUsersCurrent}</div>
                <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-top: 4px;">Active Users</div>
              </td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; background: #f8f9fa; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <tr>
              <th style="text-align: left; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #eee;">Metric</th>
              <th style="text-align: right; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #eee;">Today</th>
              <th style="text-align: right; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #eee;">Yesterday</th>
              <th style="text-align: right; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #eee;">Change</th>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; font-weight: 600;">New Signups</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right;">${stats.newUsersCurrent}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; color: #888;">${stats.newUsersPrev}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right;">${delta(stats.newUsersCurrent, stats.newUsersPrev)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; font-weight: 600; border-top: 1px solid #eee;">Workouts Logged</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${stats.workoutsCurrent}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; color: #888; border-top: 1px solid #eee;">${stats.workoutsPrev}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${delta(stats.workoutsCurrent, stats.workoutsPrev)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; font-weight: 600; border-top: 1px solid #eee;">Active Users</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${stats.activeUsersCurrent}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; color: #888; border-top: 1px solid #eee;">${stats.activeUsersPrev}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${delta(stats.activeUsersCurrent, stats.activeUsersPrev)}</td>
            </tr>
          </table>

          <div style="background: #f0f0f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 12px; color: #666; line-height: 1.6;">
            <strong style="color: #444;">Workouts Logged</strong> — total workout sessions saved by all users that day.<br/>
            <strong style="color: #444;">Active Users</strong> — unique users who logged at least one workout session that day.
          </div>

          ${stats.recentSignups.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">New Signups (Last 24h)</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <th style="text-align: left; padding: 6px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 2px solid #ddd;">Name</th>
              <th style="text-align: left; padding: 6px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 2px solid #ddd;">Contact</th>
              <th style="text-align: left; padding: 6px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 2px solid #ddd;">Location</th>
            </tr>
            ${signupRows}
          </table>
          ` : '<p style="color: #888; font-size: 13px;">No new signups in the last 24 hours.</p>'}

          <p style="color: #999; font-size: 11px; margin-top: 24px; text-align: center;">
            <a href="https://will-fit.shop/admin" style="color: #ef4444; text-decoration: none;">Open Admin Dashboard</a>
          </p>
        </div>
      `,
    });
    console.log('Daily summary email sent');
  } catch (err) {
    console.error('Failed to send daily summary:', err.message);
  }
}
