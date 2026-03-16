import { Resend } from 'resend';

export async function sendWelcomeEmail(email) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@will-fit.shop>',
      to: email,
      subject: 'Welcome to WillFit!',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 28px; margin-bottom: 8px;">Welcome to WillFit 💪</h1>
          <p style="color: #444; font-size: 16px; line-height: 1.6;">
            Your account has been created. You're all set to start tracking your workouts,
            logging personal bests, and building programs.
          </p>
          <p style="color: #444; font-size: 16px; line-height: 1.6; margin-top: 16px;">
            Congrats — you're part of a select group getting early access to the alpha version of WillFit.
            Your feedback will directly shape how this app evolves, so thank you for being here from the start.
          </p>
          <div style="margin-top: 24px; padding: 16px 20px; background: #f8f4e8; border-left: 4px solid #e6a817; border-radius: 8px;">
            <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong>You're using the alpha version of WillFit!</strong> Things are still being built and improved.
              If you run into any bugs or have features you'd like to see added, head to the
              <strong>Profile</strong> tab and tap <strong>Send Feedback</strong> — we'd love to hear from you.
            </p>
          </div>
          <a href="https://will-fit.shop"
             style="display: inline-block; margin-top: 24px; padding: 12px 24px;
                    background: #111; color: #fff; text-decoration: none;
                    border-radius: 8px; font-size: 15px;">
            Go to WillFit
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px;">
            If you didn't sign up for WillFit, you can ignore this email.
          </p>
        </div>
      `,
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
              <tr><td style="padding: 6px 0; color: #888;">Zip Code</td><td style="padding: 6px 0;">${user.zipCode || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Location</td><td style="padding: 6px 0;">${[user.signupCity, user.signupState].filter(Boolean).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Referral</td><td style="padding: 6px 0;">${user.referralSource || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #888;">Referral Code</td><td style="padding: 6px 0;">${user.referralCode || '—'}</td></tr>
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
