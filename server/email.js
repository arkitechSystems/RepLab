import { Resend } from 'resend';
import pool from './dbPool.js';
import config from './config.js';

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

  const defaultSubject = 'Welcome to RepLab!';
  // Nike-style dark theme — matches the in-app aesthetic (black bg + red
  // glow, dark gradient panels with red eyebrows, sharp 2px corners,
  // heavy display headers, red gradient CTA). Replaces the previous
  // light-on-light card design.
  const defaultHtml = `
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- Hero greeting -->
              <p style="color: rgba(239,68,68,0.9); text-transform: uppercase; letter-spacing: 0.4em; font-size: 10px; font-weight: 700; margin: 0 0 12px 0;">Welcome</p>
              <h2 style="color: #fff; font-size: 38px; font-weight: 900; line-height: 1; margin: 0 0 18px 0; letter-spacing: -0.02em; text-transform: uppercase;">You're In.</h2>
              <p style="color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.7; margin: 0 0 36px 0;">
                Thanks for signing up. Track every set, hit new PRs, and build the habits that move the needle. Here's a quick tour of what's inside.
              </p>

              <!-- Tutorial -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Step One</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Take the Tutorial</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    The in-app tutorial popped up after the 1RM step and walked you through logging a workout end-to-end. Re-run it anytime — open the app, head to the <strong style="color: #fff;">Workouts</strong> tab, and tap the <strong style="color: #fff;">Tutorial</strong> card.
                  </p>
                </div>
              </div>

              <!-- Programs Library -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Library</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Browse Programs</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    Pre-built programs ready to enroll in, including <strong style="color: #fff;">Jeff Nippard's Push Pull Legs</strong>, the <strong style="color: #fff;">Muscle &amp; Fitness 5000 Rep</strong> arm specialization, <strong style="color: #fff;">Jim Stoppani's Shortcut to Shred</strong>, Athlean-X Summer Shred, classic Bro Split, glute-focused hypertrophy blocks, and more. Tap <strong style="color: #fff;">Begin Program</strong> to auto-fill your calendar, or pull individual workouts onto specific days.
                  </p>
                </div>
              </div>

              <!-- Build Your Own -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Custom</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Build Your Own</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    Create custom workouts from scratch in <strong style="color: #fff;">My Workouts</strong>, or start a <strong style="color: #fff;">blank session</strong> right from the Workouts tab to log sets on the fly — perfect for unplanned gym days.
                  </p>
                </div>
              </div>

              <!-- Track Your Lifts -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Tracking</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Track Your Lifts</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    Log every set, rep, and weight in real time. Personal records are detected and stored automatically — tap the <strong style="color: #fff;">PRs</strong> button on any exercise card to see your bests. Workout summaries highlight new PRs in yellow. For a focused logging view, tap the viewfinder icon to enter <strong style="color: #fff;">full-screen workout mode</strong>.
                  </p>
                </div>
              </div>
              <div style="text-align: center; margin-bottom: 24px;">
                <img
                  src="${config.APP_URL}/email-img/workout-session.png"
                  alt="REPLAB workout session — set logging with timers and PR highlights"
                  style="max-width: 280px; width: 100%; height: auto; border-radius: 2px; border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 12px 40px rgba(0,0,0,0.5);"
                />
              </div>

              <!-- Plate Calculator (featured) -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444 0%, #ef4444 60%, rgba(239,68,68,0.25));"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Featured</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Plate Calculator — In Your Workout</h3>
                  <p style="color: rgba(255,255,255,0.75); font-size: 14px; line-height: 1.7; margin: 0 0 12px 0;">
                    Don't know how much weight you're doing during a workout? Open up the plate calculator without leaving your workout session and add how much weight you need to the bar.
                  </p>
                  <p style="color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; margin: 0;">
                    Tap the <strong style="color: #fff;">PC</strong> button at the top of any exercise card, or long-press a weight input. It tells you exactly which plates to slide onto each side.
                  </p>
                </div>
              </div>
              <div style="text-align: center; margin-bottom: 24px;">
                <img
                  src="${config.APP_URL}/email-img/plate-calc.png"
                  alt="REPLAB plate calculator open during a workout session, showing plates loaded on each side of the bar"
                  style="max-width: 280px; width: 100%; height: auto; border-radius: 2px; border: 1px solid rgba(239,68,68,0.20); box-shadow: 0 12px 40px rgba(0,0,0,0.5);"
                />
              </div>

              <!-- Other Built-in Tools -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Toolkit</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Other Built-in Tools</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    The <strong style="color: #fff;">Utilities</strong> tab also has a <strong style="color: #fff;">1 Rep Max Estimator</strong> that projects your max from any working set, plus a standalone version of the Plate Calculator for warmups and planning.
                  </p>
                </div>
              </div>

              <!-- Reminders -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Reminders</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Workout Reminders</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    REPLAB learns when you usually train and pings you around that time on days you have a workout scheduled. You'll also get a celebration push when you hit a new PR and a weekly summary on Sunday evenings. Adjust notifications in <strong style="color: #fff;">Profile &gt; Preferences</strong> whenever you want.
                  </p>
                </div>
              </div>

              <!-- Use on a Computer -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Desktop</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Use REPLAB on a Computer</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    Prefer a bigger screen? Open <a href="${config.APP_URL}" style="color: #ef4444; text-decoration: none; font-weight: 700;">${config.APP_URL.replace(/^https?:\/\//, '')}</a> in any browser and sign in with the same credentials. Everything stays in sync.
                  </p>
                </div>
              </div>

              <!-- User Guide -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Reference</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">User Guide</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    For a deeper look at every feature, check out the <a href="${config.APP_URL}/userguide" style="color: #ef4444; text-decoration: none; font-weight: 700;">REPLAB User Guide</a>. It covers the workout library, calendar, logging sessions, personal records, creating custom workouts, and more.
                  </p>
                </div>
              </div>

              <!-- We'd love your ideas (final pre-CTA section) -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-left: 3px solid #ef4444; border-radius: 2px; padding: 24px 28px; margin: 32px 0 36px 0; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0;">
                  We're always looking to improve the app. Let us know if you have any ideas you want incorporated — head to <strong style="color: #fff;">Profile &gt; Send Feedback</strong> and it goes straight to the dev team.
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${config.APP_URL}"
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%); color: #fff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; box-shadow: 0 4px 18px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.15);">
                  Open REPLAB
                </a>
              </div>

              <p style="color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 8px 0;">
                Thanks for being here. Glad to have you.
              </p>
              <p style="color: rgba(255,255,255,0.25); font-size: 11px; line-height: 1.6; text-align: center; margin: 0;">
                If you didn't create a REPLAB account, you can safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      `;

  try {
    await resend.emails.send({
      from: config.EMAIL_FROM_TRANSACTIONAL,
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
  const resetUrl = `${config.APP_URL}/reset-password/${token}`;

  try {
    await resend.emails.send({
      from: config.EMAIL_FROM_TRANSACTIONAL,
      to: email,
      subject: 'Reset your REPLAB password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 28px; margin-bottom: 8px;">Reset Your Password</h1>
          <p style="color: #444; font-size: 16px; line-height: 1.6;">
            We received a request to reset your REPLAB password. Click the button below to set a new one.
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
      from: config.EMAIL_FROM_TRANSACTIONAL,
      to: process.env.ADMIN_EMAIL,
      subject: `New REPLAB Signup — ${name} (#${totalUsers})`,
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
      from: config.EMAIL_FROM_TRANSACTIONAL,
      to: process.env.ADMIN_EMAIL,
      subject: `REPLAB Daily Summary — ${stats.totalUsers} users`,
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
            <a href="${config.APP_URL}/admin" style="color: #ef4444; text-decoration: none;">Open Admin Dashboard</a>
          </p>
        </div>
      `,
    });
    console.log('Daily summary email sent');
  } catch (err) {
    console.error('Failed to send daily summary:', err.message);
  }
}
