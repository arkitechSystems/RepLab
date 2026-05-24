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

// Short thank-you sent when a user joins the REPLAB Pro waiting list.
// Style mirrors the marketing landing: black bg with subtle red glow, big
// REPLAB wordmark, eyebrow + heading + lede, ArkiTech footer. Kept short
// on purpose -- the email exists to confirm signup, nothing more.
export async function sendWaitlistThankYouEmail(email) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping waitlist thank-you email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = "You're on the REPLAB Pro waiting list";
  const html = `
    <div style="background: #000; margin: 0; padding: 0;">
      <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

          <!-- Header: REPLAB wordmark + red rule -->
          <div style="text-align: center; margin-bottom: 48px;">
            <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
            <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
          </div>

          <!-- Body -->
          <p style="color: rgba(239,68,68,0.9); text-transform: uppercase; letter-spacing: 0.4em; font-size: 10px; font-weight: 700; margin: 0 0 12px 0; text-align: center;">Waiting List</p>
          <h2 style="color: #fff; font-size: 36px; font-weight: 900; line-height: 1; margin: 0 0 18px 0; letter-spacing: -0.02em; text-transform: uppercase; text-align: center;">You're In.</h2>
          <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; margin: 0 0 36px 0; text-align: center;">
            Thank you for joining the waiting list. We'll let you know when Pro is released.
          </p>

          <!-- Footer -->
          <div style="margin-top: 56px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
            <p style="color: rgba(255,255,255,0.35); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; margin: 0;">Developed by ArkiTech Systems</p>
          </div>

        </div>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: config.EMAIL_FROM_TRANSACTIONAL,
      to: email,
      subject,
      html,
    });
  } catch (err) {
    // Don't fail the waitlist signup if email sending fails.
    console.error('Failed to send waitlist thank-you email:', err.message);
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
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- Reset panel -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 32px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Account</p>
                  <h2 style="color: #fff; font-size: 32px; font-weight: 900; line-height: 1; margin: 0 0 18px 0; letter-spacing: -0.01em; text-transform: uppercase;">Reset Your Password</h2>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0 0 28px 0;">
                    We received a request to reset your REPLAB password. Click the button below to set a new one. This link expires in <strong style="color: #fff;">1 hour</strong>.
                  </p>
                  <div style="text-align: center; margin-bottom: 8px;">
                    <a href="${resetUrl}"
                       style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%); color: #fff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; box-shadow: 0 4px 18px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.15);">
                      Reset Password
                    </a>
                  </div>
                </div>
              </div>

              <p style="color: rgba(255,255,255,0.25); font-size: 11px; line-height: 1.6; text-align: center; margin: 0;">
                If you didn't request this, you can safely ignore this email. Your password won't change.
              </p>
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send reset email:', err.message);
  }
}

export async function sendDeletionConfirmationEmail(email, token) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping deletion confirmation email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const confirmUrl = `${config.APP_URL}/auth/confirm-deletion?token=${token}`;

  try {
    await resend.emails.send({
      from: config.EMAIL_FROM_TRANSACTIONAL,
      to: email,
      subject: 'Confirm your REPLAB account deletion',
      html: `
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- Deletion panel -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 32px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Account Deletion</p>
                  <h2 style="color: #fff; font-size: 30px; font-weight: 900; line-height: 1; margin: 0 0 18px 0; letter-spacing: -0.01em; text-transform: uppercase;">Confirm Account Deletion</h2>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
                    We received a request to delete your REPLAB account. Clicking the button below will <strong style="color: #fff;">permanently delete</strong> your account and all associated data — workouts, programs, personal records, body metrics, schedule, and subscription history.
                  </p>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0 0 28px 0;">
                    This action <strong style="color: #fff;">cannot be undone</strong>. The link expires in <strong style="color: #fff;">24 hours</strong>.
                  </p>
                  <div style="text-align: center; margin-bottom: 8px;">
                    <a href="${confirmUrl}"
                       style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%); color: #fff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; box-shadow: 0 4px 18px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.15);">
                      Delete My Account
                    </a>
                  </div>
                </div>
              </div>

              <p style="color: rgba(255,255,255,0.25); font-size: 11px; line-height: 1.6; text-align: center; margin: 0;">
                If you didn't request this deletion, you can safely ignore this email. Your account will remain active.
              </p>
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send deletion confirmation email:', err.message);
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
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- User details panel -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Signup</p>
                  <h2 style="color: #fff; font-size: 26px; font-weight: 900; line-height: 1.1; margin: 0 0 20px 0; letter-spacing: -0.01em; text-transform: uppercase;">New User Signup</h2>
                  <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); width: 130px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Name</td><td style="padding: 8px 0; color: #fff; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.06);">${name}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Email</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.email || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Phone</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.phone || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Username</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.username || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Gender</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.gender || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Device</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.signupDevice || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Zip Code</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.zipCode || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Location</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${[user.signupCity, user.signupState].filter(Boolean).join(', ') || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; border-bottom: 1px solid rgba(255,255,255,0.06);">Referral</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.06);">${user.referralSource || '—'}</td></tr>
                    <tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; ${user.utmSource || user.utmMedium || user.utmCampaign ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">Referral Code</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); ${user.utmSource || user.utmMedium || user.utmCampaign ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">${user.referralCode || '—'}</td></tr>
                    ${user.utmSource ? `<tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; ${user.utmMedium || user.utmCampaign ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">UTM Source</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); ${user.utmMedium || user.utmCampaign ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">${user.utmSource}</td></tr>` : ''}
                    ${user.utmMedium ? `<tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; ${user.utmCampaign ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">UTM Medium</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85); ${user.utmCampaign ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">${user.utmMedium}</td></tr>` : ''}
                    ${user.utmCampaign ? `<tr><td style="padding: 8px 0; color: rgba(255,255,255,0.45); font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em;">UTM Campaign</td><td style="padding: 8px 0; color: rgba(255,255,255,0.85);">${user.utmCampaign}</td></tr>` : ''}
                  </table>
                </div>
              </div>

              <!-- Total users big number panel -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444 0%, #ef4444 60%, rgba(239,68,68,0.25));"></div>
                <div style="padding: 28px 20px; text-align: center;">
                  <div style="font-size: 56px; font-weight: 900; color: #ef4444; line-height: 1; letter-spacing: -0.02em; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">${totalUsers}</div>
                  <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; color: rgba(255,255,255,0.5); margin-top: 12px; font-weight: 700;">Total Users</div>
                </div>
              </div>
            </div>
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
    return `<span style="color: rgba(255,255,255,0.4);">0 &#8212;</span>`;
  }

  const signupRows = stats.recentSignups.map((u) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
    const loc = [u.signup_city, u.signup_state].filter(Boolean).join(', ') || '—';
    return `<tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: #fff;">${name}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: rgba(255,255,255,0.75);">${u.email || u.phone || '—'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: rgba(255,255,255,0.75);">${loc}</td>
    </tr>`;
  }).join('');

  try {
    await resend.emails.send({
      from: config.EMAIL_FROM_TRANSACTIONAL,
      to: process.env.ADMIN_EMAIL,
      subject: `REPLAB Daily Summary — ${stats.totalUsers} users`,
      html: `
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- Header -->
              <p style="color: rgba(239,68,68,0.9); text-transform: uppercase; letter-spacing: 0.4em; font-size: 10px; font-weight: 700; margin: 0 0 12px 0;">Admin Digest</p>
              <h2 style="color: #fff; font-size: 32px; font-weight: 900; line-height: 1; margin: 0 0 8px 0; letter-spacing: -0.02em; text-transform: uppercase;">Daily Summary</h2>
              <p style="color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; margin: 0 0 32px 0; text-transform: uppercase; letter-spacing: 0.2em;">${today}</p>

              <!-- Top stat tiles -->
              <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 16px;">
                <tr>
                  <td style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; padding: 0; text-align: center; width: 33%; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                    <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                    <div style="padding: 20px 8px;">
                      <div style="font-size: 32px; font-weight: 900; color: #ef4444; line-height: 1; letter-spacing: -0.02em;">${stats.totalUsers}</div>
                      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: rgba(255,255,255,0.5); margin-top: 10px; font-weight: 700;">Total Users</div>
                    </div>
                  </td>
                  <td style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; padding: 0; text-align: center; width: 33%; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                    <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                    <div style="padding: 20px 8px;">
                      <div style="font-size: 32px; font-weight: 900; color: #fff; line-height: 1; letter-spacing: -0.02em;">${stats.workoutsCurrent}</div>
                      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: rgba(255,255,255,0.5); margin-top: 10px; font-weight: 700;">Workouts Today</div>
                    </div>
                  </td>
                  <td style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; padding: 0; text-align: center; width: 33%; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                    <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                    <div style="padding: 20px 8px;">
                      <div style="font-size: 32px; font-weight: 900; color: #fff; line-height: 1; letter-spacing: -0.02em;">${stats.activeUsersCurrent}</div>
                      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: rgba(255,255,255,0.5); margin-top: 10px; font-weight: 700;">Active Users</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Metrics table panel -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 16px 0;">Day Over Day</p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <th style="text-align: left; padding: 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700;">Metric</th>
                      <th style="text-align: right; padding: 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700;">Today</th>
                      <th style="text-align: right; padding: 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700;">Yesterday</th>
                      <th style="text-align: right; padding: 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700;">Change</th>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 14px; font-weight: 600; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06);">New Signups</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06);">${stats.newUsersCurrent}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.06);">${stats.newUsersPrev}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.06);">${delta(stats.newUsersCurrent, stats.newUsersPrev)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 14px; font-weight: 600; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06);">Workouts Logged</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.06);">${stats.workoutsCurrent}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.06);">${stats.workoutsPrev}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.06);">${delta(stats.workoutsCurrent, stats.workoutsPrev)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-size: 14px; font-weight: 600; color: #fff;">Active Users</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; color: #fff;">${stats.activeUsersCurrent}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right; color: rgba(255,255,255,0.5);">${stats.activeUsersPrev}</td>
                      <td style="padding: 12px 0; font-size: 14px; text-align: right;">${delta(stats.activeUsersCurrent, stats.activeUsersPrev)}</td>
                    </tr>
                  </table>
                </div>
              </div>

              <!-- Legend -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-left: 3px solid #ef4444; border-radius: 2px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <p style="color: rgba(255,255,255,0.6); font-size: 12px; line-height: 1.7; margin: 0;">
                  <strong style="color: #fff;">Workouts Logged</strong> — total workout sessions saved by all users that day.<br/>
                  <strong style="color: #fff;">Active Users</strong> — unique users who logged at least one workout session that day.
                </p>
              </div>

              ${stats.recentSignups.length > 0 ? `
              <!-- Recent signups panel -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Last 24h</p>
                  <h3 style="color: #fff; font-size: 18px; font-weight: 900; line-height: 1.1; margin: 0 0 16px 0; letter-spacing: -0.01em; text-transform: uppercase;">New Signups</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <th style="text-align: left; padding: 8px 12px 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.12); font-weight: 700;">Name</th>
                      <th style="text-align: left; padding: 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.12); font-weight: 700;">Contact</th>
                      <th style="text-align: left; padding: 8px 0 8px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.12); font-weight: 700;">Location</th>
                    </tr>
                    ${signupRows}
                  </table>
                </div>
              </div>
              ` : `
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 24px; padding: 20px 28px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05); text-align: center;">
                <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0;">No new signups in the last 24 hours.</p>
              </div>
              `}

              <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 8px 0 0 0; text-align: center; text-transform: uppercase; letter-spacing: 0.25em;">
                <a href="${config.APP_URL}/admin" style="color: #ef4444; text-decoration: none; font-weight: 700;">Open Admin Dashboard</a>
              </p>
            </div>
          </div>
        </div>
      `,
    });
    console.log('Daily summary email sent');
  } catch (err) {
    console.error('Failed to send daily summary:', err.message);
  }
}
