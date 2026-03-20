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

          <h2 style="color: #111; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">Welcome to the Alpha!</h2>
          <p style="font-size: 16px; line-height: 1.7; margin: 0 0 24px 0; color: #444;">
            Thanks for signing up. The alpha version of WillFit is ready to use — you can start tracking workouts right now. Here's how to get going.
          </p>

          <!-- Quick Start -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">Quick Start Guide</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 12px; vertical-align: top; width: 28px; font-size: 18px; font-weight: 900; color: #EF4444;">1</td>
              <td style="padding: 10px 12px; font-size: 14px; line-height: 1.6; color: #444;">
                <strong style="color: #111;">Pick a Workout</strong><br/>
                Open the app and head to the <strong>Workout Library</strong>. Browse pre-built programs like Push Pull Legs, Upper/Lower, Bro Split, and more. Find one you like and tap <strong>Begin Program</strong> to add it to your calendar.
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; vertical-align: top; width: 28px; font-size: 18px; font-weight: 900; color: #EF4444;">2</td>
              <td style="padding: 10px 12px; font-size: 14px; line-height: 1.6; color: #444;">
                <strong style="color: #111;">Start Your Session</strong><br/>
                Go to the <strong>Calendar</strong> tab, tap today's workout, and start logging. Enter your weight and reps for each set — the app saves everything and tracks your personal records automatically.
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; vertical-align: top; width: 28px; font-size: 18px; font-weight: 900; color: #EF4444;">3</td>
              <td style="padding: 10px 12px; font-size: 14px; line-height: 1.6; color: #444;">
                <strong style="color: #111;">Create Your Own</strong><br/>
                Want something custom? You can build your own workouts directly in the app under <strong>My Workouts</strong>. You can also create and manage workouts from a computer at <a href="https://will-fit.shop/trainer" style="color: #EF4444; text-decoration: none; font-weight: 600;">will-fit.shop/trainer</a> — just log in with the same account.
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; vertical-align: top; width: 28px; font-size: 18px; font-weight: 900; color: #EF4444;">4</td>
              <td style="padding: 10px 12px; font-size: 14px; line-height: 1.6; color: #444;">
                <strong style="color: #111;">Track Your Progress</strong><br/>
                Check the <strong>Utilities</strong> tab to view personal records, estimate your one-rep max, and use the rest timer between sets. Your PRs update automatically every time you log a session.
              </td>
            </tr>
          </table>

          <a href="https://will-fit.shop"
             style="display: inline-block; padding: 14px 32px; background: #111; color: #fff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
            Open WillFit
          </a>

          <!-- FAQ Link -->
          <div style="margin-top: 24px; padding: 14px 20px; background: #f0f0f0; border-radius: 8px; text-align: center;">
            <p style="color: #444; font-size: 13px; line-height: 1.6; margin: 0;">
              Need help? Check out the <a href="https://will-fit.shop/trainer/guide" style="color: #EF4444; text-decoration: none; font-weight: 600;">WillFit User Guide</a> for detailed instructions on every feature.
            </p>
          </div>

          <!-- Early Access -->
          <div style="margin-top: 16px; padding: 16px 20px; background: #f8f4e8; border-left: 4px solid #e6a817; border-radius: 8px;">
            <p style="color: #333; font-size: 13px; line-height: 1.7; margin: 0;">
              <strong>You're part of the alpha.</strong> This app is actively being built and improved. More features are on the way. Your feedback directly shapes what gets built next — head to <strong>Profile > Send Feedback</strong> anytime.
            </p>
          </div>

          <p style="color: #666; font-size: 13px; margin-top: 24px; line-height: 1.6;">
            Thanks for downloading the app. We're excited to have you.
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 24px; line-height: 1.6;">
            If you didn't create a WillFit account, you can safely ignore this email.
          </p>
        </div>
      `;

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@will-fit.shop>',
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
      from: 'WillFit <noreply@will-fit.shop>',
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
      from: 'WillFit <noreply@will-fit.shop>',
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
      from: 'WillFit <noreply@will-fit.shop>',
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
                <div style="font-size: 28px; font-weight: 900;">${stats.workoutsToday}</div>
                <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-top: 4px;">Workouts Today</div>
              </td>
              <td style="padding: 16px; background: #111; color: #fff; border-radius: 0 12px 0 0; text-align: center; width: 33%;">
                <div style="font-size: 28px; font-weight: 900;">${stats.activeUsersToday}</div>
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
              <td style="padding: 10px 16px; font-size: 14px; text-align: right;">${stats.newUsersToday}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; color: #888;">${stats.newUsersYesterday}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right;">${delta(stats.newUsersToday, stats.newUsersYesterday)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; font-weight: 600; border-top: 1px solid #eee;">Workouts Logged</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${stats.workoutsToday}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; color: #888; border-top: 1px solid #eee;">${stats.workoutsYesterday}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${delta(stats.workoutsToday, stats.workoutsYesterday)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-size: 14px; font-weight: 600; border-top: 1px solid #eee;">Active Users</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${stats.activeUsersToday}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; color: #888; border-top: 1px solid #eee;">${stats.activeUsersYesterday}</td>
              <td style="padding: 10px 16px; font-size: 14px; text-align: right; border-top: 1px solid #eee;">${delta(stats.activeUsersToday, stats.activeUsersYesterday)}</td>
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
            <a href="https://will-fit.shop/admin?key=${process.env.ADMIN_KEY || ''}" style="color: #ef4444; text-decoration: none;">Open Admin Dashboard</a>
          </p>
        </div>
      `,
    });
    console.log('Daily summary email sent');
  } catch (err) {
    console.error('Failed to send daily summary:', err.message);
  }
}
