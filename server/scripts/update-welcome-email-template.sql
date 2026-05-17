-- update-welcome-email-template.sql
--
-- Purpose:
--   Replace the stale "WillFit"-era row in production `email_templates` (name = 'welcome')
--   with the current REPLAB branding, copy, and replab-fitness.com URLs. The DB row
--   overrides the hardcoded default in server/email.js (sendWelcomeEmail), so until this
--   runs, real signups receive the old WillFit copy with dead https://will-fit.shop links.
--
-- When to run:
--   After the Resend domain `email.replab-fitness.com` is verified (currently failing 403
--   "domain is not verified"). Once that clears and welcome emails start sending, run
--   this once against the production Postgres DB on Render. No code deploy required —
--   server/email.js already reads this row at send time via getTemplate('welcome').
--
-- Side effects:
--   - Updates exactly one row in `email_templates` (the `welcome` template).
--   - Sets `updated_at = NOW()`.
--   - Does NOT insert if the row is missing (the guard below will raise instead).
--
-- Idempotency:
--   Safe to re-run. Each execution overwrites subject/html with the same canonical
--   content and bumps updated_at. Wrapped in a transaction so a failure rolls back.
--
-- Source of truth:
--   server/email.js — `sendWelcomeEmail` `defaultHtml`. Keep this script in sync if
--   that block is edited.

BEGIN;

-- Guard: assert exactly one matching row exists before we touch anything.
DO $$
DECLARE
  match_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO match_count FROM email_templates WHERE name = 'welcome';
  IF match_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 row in email_templates WHERE name = ''welcome'', found %', match_count;
  END IF;
END $$;

UPDATE email_templates
SET
  subject = 'Welcome to REPLAB — You''re In!',
  html = '
        <div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #333;">
          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 32px; font-weight: 900; letter-spacing: 2px; margin: 0; color: #111;">REP<span style="color: #EF4444;">LAB</span></h1>
          </div>

          <h2 style="color: #111; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">Welcome to REPLAB!</h2>
          <p style="font-size: 16px; line-height: 1.7; margin: 0 0 24px 0; color: #444;">
            Thanks for signing up! You''re now part of the <strong>alpha version</strong> of REPLAB. The app is fully functional and ready for you to start tracking your workouts, but we''re still actively building and improving it. Your experience and feedback will help shape the final product.
          </p>

          <!-- Getting Started -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">Getting Started</h3>
          <div style="background: #f0f7ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              <strong>New here? Take the tutorial.</strong> When you open the app, tap the <strong>Tutorial</strong> card on the Workouts page. It''ll walk you step by step through picking a program, scheduling it to your calendar, and logging your first workout.
            </p>
          </div>

          <!-- Trainer Dashboard -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">Trainer Dashboard</h3>
          <div style="background: #f8f8f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              <strong>Prefer a bigger screen?</strong> You can create and manage your workouts from a computer using the <a href="https://replab-fitness.com/trainer" style="color: #EF4444; text-decoration: none; font-weight: 600;">Trainer Dashboard</a>. Just log in with the same credentials you used to sign up. Everything stays in sync with the app.
            </p>
          </div>

          <!-- AI-Powered Features -->
          <h3 style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-top: 8px; border-top: 1px solid #eee;">AI-Powered Features</h3>
          <div style="background: #f0f0ff; border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0;">
              We''re working on <strong>AI-powered features</strong> for REPLAB. Soon you''ll be able to generate custom workouts tailored to your goals, experience level, and available equipment — powered by an <strong>AI trainer</strong> built right into the app. Stay tuned.
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
              For a deeper look at every feature, check out the <a href="https://replab-fitness.com/userguide" style="color: #EF4444; text-decoration: none; font-weight: 600;">REPLAB User Guide</a>. It covers the workout library, calendar, logging sessions, personal records, creating custom workouts, and more.
            </p>
          </div>

          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            Thanks for being an early adopter. We''re glad to have you.
          </p>

          <a href="https://replab-fitness.com"
             style="display: inline-block; margin-top: 24px; padding: 14px 32px; background: #111; color: #fff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
            Open REPLAB
          </a>

          <p style="color: #999; font-size: 12px; margin-top: 24px; line-height: 1.6;">
            If you didn''t create a REPLAB account, you can safely ignore this email.
          </p>
        </div>
      ',
  updated_at = NOW()
WHERE name = 'welcome';

-- Confirmation row for the operator.
SELECT name, subject, LEFT(html, 80) AS html_preview, updated_at
FROM email_templates
WHERE name = 'welcome';

COMMIT;
