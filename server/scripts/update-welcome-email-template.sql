-- update-welcome-email-template.sql
--
-- Purpose:
--   Keep production `email_templates` (name = 'welcome') in sync with the
--   defaultHtml in server/email.js's sendWelcomeEmail. The DB row overrides
--   the hardcoded default at send time, so this is the source of truth for
--   what users actually receive.
--
-- When to run:
--   After any edit to the welcome template HTML in server/email.js. Apply
--   via `node --env-file=server/.env server/scripts/run-welcome-template-update.js`
--   which captures pre/post state for rollback reference.
--
-- Side effects:
--   - Updates exactly one row in `email_templates` (the `welcome` template).
--   - Sets `updated_at = NOW()`.
--   - Does NOT insert if the row is missing (the guard below will raise instead).
--
-- Idempotency:
--   Safe to re-run. Wrapped in a transaction so a failure rolls back cleanly.
--
-- Source of truth:
--   server/email.js — `sendWelcomeEmail` `defaultHtml`. Keep this script in sync
--   with any edits to that block.

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
  subject = 'Welcome to RepLab!',
  html = '
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 72px; margin: 16px auto 0; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- Hero greeting -->
              <p style="color: rgba(239,68,68,0.9); text-transform: uppercase; letter-spacing: 0.4em; font-size: 10px; font-weight: 700; margin: 0 0 12px 0;">Welcome</p>
              <h2 style="color: #fff; font-size: 38px; font-weight: 900; line-height: 1; margin: 0 0 18px 0; letter-spacing: -0.02em; text-transform: uppercase;">You''re In.</h2>
              <p style="color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.7; margin: 0 0 36px 0;">
                Thanks for signing up. Track every set, hit new PRs, and build the habits that move the needle. Here''s a quick tour of what''s inside.
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
                    Pre-built programs ready to enroll in, including <strong style="color: #fff;">Jeff Nippard''s Push Pull Legs</strong>, the <strong style="color: #fff;">Muscle &amp; Fitness 5000 Rep</strong> arm specialization, <strong style="color: #fff;">Jim Stoppani''s Shortcut to Shred</strong>, Athlean-X Summer Shred, classic Bro Split, glute-focused hypertrophy blocks, and more. Tap <strong style="color: #fff;">Begin Program</strong> to auto-fill your calendar, or pull individual workouts onto specific days.
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
                  src="https://replab-fitness.com/email-img/workout-session.png"
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
                    Don''t know how much weight you''re doing during a workout? Open up the plate calculator without leaving your workout session and add how much weight you need to the bar.
                  </p>
                  <p style="color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; margin: 0;">
                    Tap the <strong style="color: #fff;">PC</strong> button at the top of any exercise card, or long-press a weight input. It tells you exactly which plates to slide onto each side.
                  </p>
                </div>
              </div>
              <div style="text-align: center; margin-bottom: 24px;">
                <img
                  src="https://replab-fitness.com/email-img/plate-calc.png"
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
                    REPLAB learns when you usually train and pings you around that time on days you have a workout scheduled. You''ll also get a celebration push when you hit a new PR and a weekly summary on Sunday evenings. Adjust notifications in <strong style="color: #fff;">Profile &gt; Preferences</strong> whenever you want.
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
                    Prefer a bigger screen? Open <a href="https://replab-fitness.com" style="color: #ef4444; text-decoration: none; font-weight: 700;">replab-fitness.com</a> in any browser and sign in with the same credentials. Everything stays in sync.
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
                    For a deeper look at every feature, check out the <a href="https://replab-fitness.com/userguide" style="color: #ef4444; text-decoration: none; font-weight: 700;">REPLAB User Guide</a>. It covers the workout library, calendar, logging sessions, personal records, creating custom workouts, and more.
                  </p>
                </div>
              </div>

              <!-- We''d love your ideas -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-left: 3px solid #ef4444; border-radius: 2px; padding: 24px 28px; margin: 32px 0 36px 0; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0;">
                  We''re always looking to improve the app. Let us know if you have any ideas you want incorporated — head to <strong style="color: #fff;">Profile &gt; Send Feedback</strong> and it goes straight to the dev team.
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="https://replab-fitness.com"
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%); color: #fff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; box-shadow: 0 4px 18px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.15);">
                  Open REPLAB
                </a>
              </div>

              <p style="color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 8px 0;">
                Thanks for being here. Glad to have you.
              </p>
              <p style="color: rgba(255,255,255,0.25); font-size: 11px; line-height: 1.6; text-align: center; margin: 0;">
                If you didn''t create a REPLAB account, you can safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      ',
  updated_at = NOW()
WHERE name = 'welcome';

-- Confirmation row for the operator.
SELECT name, subject, LEFT(html, 80) AS html_preview, updated_at
FROM email_templates
WHERE name = 'welcome';

COMMIT;
