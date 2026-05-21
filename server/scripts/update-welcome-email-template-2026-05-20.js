// One-off: update the welcome email_templates row with the 2026-05-20 content revisions.
// Run: node --env-file=server/.env server/scripts/update-welcome-email-template-2026-05-20.js
//
// Latest revision (2026-05-20 evening):
//   - REPLAB logo divider line now spans full container width
//   - Hero eyebrow swapped to "You're In", big headline now "Welcome to REPLAB!" (centered)
//   - "Open Web App" button restyled to match the sign-in button (full-width, sharp 2px corners,
//     11px tracked uppercase, red 0.9 gradient, sign-in-style shadow)
//   - iOS + Android buttons replaced with the landing page's AppStoreBadges look:
//     inline Apple glyph + "Download on the / App Store", inline Google Play multi-color
//     triangle + "GET IT ON / Google Play". 10px corners, 1px white/60 border, 52px tall.
//     Both buttons still href="#" until App Store + Play Store submissions land.
//   - Featured Workouts card is now first (was second / "Guided Workouts — Coming Soon"):
//       eyebrow stays "Coming Soon", title now "Featured Workouts",
//       body rewritten for demo videos + downloadable PDF.
//   - REPLAB Pro Coming Soon card is now second
//   - "Join the Waiting List" button restyled to match the sign-in button + centered
//
// Prior revision changes (still in this template):
//   - Open Web App CTA moved to the top (replaces the bottom "Open REPLAB" button)
//   - Take the Tutorial: present-tense + "from start to finish"
//   - Browse Programs: Muscle & Fitness 5000 first; Athlean-X + Bro Split removed
//   - Build Your Own: rewritten for Create button + Calendar Edit + empty session
//   - Track Your Lifts replaced with Personal Records card
//   - Other Built-in Tools: HIIT Timer + Exercise Library added
//   - Workout Reminders card removed
//   - Use REPLAB on a Computer: new opener + closing line about workout/program sync
//   - Bottom Open REPLAB CTA removed
//   - Subject brand-spelling fix (RepLab → REPLAB)
//   - Screenshot <img> blocks omitted (client/public/email-img/*.png files don't exist yet)
//
// TODO post-launch (logged in _marketing/PRE-LAUNCH.md): swap the href="#" placeholders
// on the App Store + Google Play buttons for the real store URLs.

import pool from '../dbPool.js';

const subject = 'Welcome to REPLAB!';

// Sign-in button styling — mirrors client/src/pages/Login.jsx:188-216
// Used for the top "Open Web App" CTA and the "Join the Waiting List" CTA so
// every primary action in the email reads as the same product as the sign-in surface.
const signInButtonStyle = "display: block; width: 100%; padding: 12px 14px; border: none; border-radius: 2px; background: linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%); color: #fff; text-decoration: none; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; box-shadow: 0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15); box-sizing: border-box; white-space: nowrap;";

// App Store badge — mirrors client/src/components/AppStoreBadges.jsx
// Inline SVG so it renders without an asset pipeline. Wrapped in <a href="#">
// so post-launch link swap is a one-character edit.
const appStoreBadge = `
                    <a href="#" style="display: inline-block; background: #000; border: 1px solid rgba(255,255,255,0.6); border-radius: 10px; padding: 0 14px; height: 52px; text-decoration: none; color: #fff; box-sizing: border-box;">
                      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse; height: 52px;">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle; line-height: 0;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                            </svg>
                          </td>
                          <td style="vertical-align: middle; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; text-align: left; line-height: 1;">
                            <div style="font-size: 9px; color: rgba(255,255,255,0.95); margin-bottom: 3px; letter-spacing: -0.01em;">Download on the</div>
                            <div style="font-size: 18px; font-weight: 600; color: #fff; letter-spacing: -0.01em;">App Store</div>
                          </td>
                        </tr>
                      </table>
                    </a>`;

// Google Play badge — mirrors client/src/components/AppStoreBadges.jsx
// Inline SVG with the four-panel play triangle (linear gradients per panel).
// Gmail / Apple Mail / iOS Mail render this; Outlook desktop may show
// solid-color fallback or no glyph, but that's the same fate as the landing page.
const googlePlayBadge = `
                    <a href="#" style="display: inline-block; background: #000; border: 1px solid rgba(255,255,255,0.6); border-radius: 10px; padding: 0 14px; height: 52px; text-decoration: none; color: #fff; box-sizing: border-box;">
                      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse; height: 52px;">
                        <tr>
                          <td style="padding-right: 10px; vertical-align: middle; line-height: 0;">
                            <svg width="24" height="24" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <defs>
                                <linearGradient id="gp-blue" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stop-color="#00A0FF"/>
                                  <stop offset="100%" stop-color="#00DCFA"/>
                                </linearGradient>
                                <linearGradient id="gp-green" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stop-color="#00A071"/>
                                  <stop offset="100%" stop-color="#00F076"/>
                                </linearGradient>
                                <linearGradient id="gp-yellow" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stop-color="#FFBD00"/>
                                  <stop offset="100%" stop-color="#FFE000"/>
                                </linearGradient>
                                <linearGradient id="gp-red" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stop-color="#FF3A44"/>
                                  <stop offset="100%" stop-color="#C31162"/>
                                </linearGradient>
                              </defs>
                              <path d="M2 2 L33 30 L2 58 Z" fill="url(#gp-blue)"/>
                              <path d="M2 58 L33 30 L45 42 Z" fill="url(#gp-green)"/>
                              <path d="M2 2 L33 30 L45 18 Z" fill="url(#gp-yellow)"/>
                              <path d="M45 18 L58 30 L45 42 Z" fill="url(#gp-red)"/>
                            </svg>
                          </td>
                          <td style="vertical-align: middle; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; text-align: left; line-height: 1;">
                            <div style="font-size: 9px; color: rgba(255,255,255,0.95); margin-bottom: 3px; letter-spacing: -0.01em;">GET IT ON</div>
                            <div style="font-size: 18px; font-weight: 600; color: #fff; letter-spacing: -0.01em;">Google Play</div>
                          </td>
                        </tr>
                      </table>
                    </a>`;

const html = `
        <div style="background: #000; margin: 0; padding: 0;">
          <div style="background-color: #0a0a0a; background-image: radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #000 100%); padding: 48px 16px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #fff;">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h1 style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; text-shadow: 0 2px 24px rgba(239,68,68,0.35);">REP<span style="color: #ef4444;">LAB</span></h1>
                <div style="height: 3px; width: 100%; margin: 16px 0 0; background: linear-gradient(90deg, transparent, rgba(239,68,68,0.25), #ef4444, rgba(239,68,68,0.25), transparent);"></div>
              </div>

              <!-- Hero greeting -->
              <p style="color: rgba(239,68,68,0.9); text-transform: uppercase; letter-spacing: 0.4em; font-size: 10px; font-weight: 700; margin: 0 0 12px 0;">You're In</p>
              <h2 style="color: #fff; font-size: 38px; font-weight: 900; line-height: 1.05; margin: 0 0 18px 0; letter-spacing: -0.02em; text-align: center;">Welcome to REPLAB!</h2>
              <p style="color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.7; margin: 0 0 28px 0;">
                Thanks for signing up. Track every set, hit new PRs, and build the habits that move the needle. Here's a quick tour of what's inside.
              </p>

              <!-- Open Web App CTA (top) — sign-in button look -->
              <div style="margin-bottom: 20px;">
                <a href="https://replab-fitness.com" style="${signInButtonStyle}">Open Web App</a>
              </div>

              <!-- Mobile app row (App Store + Google Play badges, inert until store submissions land) -->
              <p style="color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; text-align: center; margin: 14px 0 12px 0;">Get the mobile app</p>
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin: 0 auto 40px auto; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0 6px 0 0;">${appStoreBadge}</td>
                  <td style="padding: 0 0 0 6px;">${googlePlayBadge}</td>
                </tr>
              </table>

              <!-- Featured Workouts (first coming-soon card) -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Coming Soon</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Featured Workouts</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    Featured workouts are coming soon — each one with <strong style="color: #fff;">demo videos for every exercise</strong> and a <strong style="color: #fff;">downloadable PDF</strong> of the workout so you can take it to the gym. Keep an eye on the <strong style="color: #fff;">Featured Workouts</strong> section to see them as they drop.
                  </p>
                </div>
              </div>

              <!-- REPLAB Pro waiting list (second coming-soon card) -->
              <div style="background: linear-gradient(160deg, #1f1416 0%, #14090c 100%); border: 1px solid rgba(239,68,68,0.28); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444 0%, #ef4444 60%, rgba(239,68,68,0.25));"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.95); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Coming Soon</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">REPLAB Pro</h3>
                  <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0 0 18px 0;">
                    REPLAB Pro is on the way — premium tier with the AI workout generator, advanced analytics, and more. Join the waiting list to be first in line when it launches (and to lock in early-bird pricing).
                  </p>
                  <a href="https://replab-fitness.com/waiting-list" style="${signInButtonStyle}">Join the Waiting List</a>
                </div>
              </div>

              <!-- Use on a PC (moved here to sit right before the Tutorial) -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Desktop</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Use REPLAB on a PC</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    Prefer to plan your workouts on a computer? Open <a href="https://replab-fitness.com" style="color: #ef4444; text-decoration: none; font-weight: 700;">replab-fitness.com</a> in any browser and sign in with the same credentials. Create your own workouts or entire programs from your computer and they'll sync straight to the app.
                  </p>
                </div>
              </div>

              <!-- Tutorial -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Step One</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Take the Tutorial</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    The in-app tutorial pops up after the 1RM step and walks you through logging a workout from start to finish. Re-run it anytime — open the app, head to the <strong style="color: #fff;">Workouts</strong> tab, and tap the <strong style="color: #fff;">Tutorial</strong> card.
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
                    Pre-built programs ready to enroll in, including the <strong style="color: #fff;">Muscle &amp; Fitness 5000 Rep Arm Specialization</strong>, <strong style="color: #fff;">Jeff Nippard's Push Pull Legs</strong>, <strong style="color: #fff;">Jim Stoppani's Shortcut to Shred</strong>, glute-focused hypertrophy blocks, and more. Tap <strong style="color: #fff;">Begin Program</strong> to auto-fill your calendar, or add an individual workout from the program to perform as a standalone workout.
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
                    Create custom workouts from scratch by tapping the <strong style="color: #fff;">Create</strong> button at the top right of the Workouts screen, or by going to the weekly Calendar and hitting <strong style="color: #fff;">Edit</strong>. You can also start an <strong style="color: #fff;">empty workout session</strong> to log sets on the fly — perfect for unplanned gym days.
                  </p>
                </div>
              </div>

              <!-- Personal Records -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Personal Records</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Track Your PRs</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    A <strong style="color: #fff;">Personal Record (PR)</strong> is your best-ever performance for an exercise at any given rep count. REPLAB detects and stores them automatically as you log sets. View all of your PRs by muscle group from the home page — head to <strong style="color: #fff;">Utilities &gt; Personal Records</strong>. Or, during a workout, tap the <strong style="color: #fff;">PRs</strong> button at the top of any exercise card to see your bests for that lift right where you're training.
                  </p>
                </div>
              </div>
              <!-- (workout-session screenshot removed — restore once client/public/email-img/workout-session.png exists) -->

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
              <!-- (plate-calc screenshot removed — restore once client/public/email-img/plate-calc.png exists) -->

              <!-- Other Built-in Tools -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-radius: 2px; margin-bottom: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <div style="height: 3px; background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent);"></div>
                <div style="padding: 24px 28px;">
                  <p style="color: rgba(239,68,68,0.85); text-transform: uppercase; letter-spacing: 0.3em; font-size: 9px; font-weight: 700; margin: 0 0 8px 0;">Toolkit</p>
                  <h3 style="color: #fff; font-size: 22px; font-weight: 900; line-height: 1.1; margin: 0 0 14px 0; letter-spacing: -0.01em; text-transform: uppercase;">Other Built-in Tools</h3>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.7; margin: 0;">
                    The <strong style="color: #fff;">Utilities</strong> tab also has a <strong style="color: #fff;">1 Rep Max Estimator</strong> that projects your max from any working set, a standalone version of the Plate Calculator for warmups and planning, a <strong style="color: #fff;">HIIT Timer</strong> for interval work, and the full <strong style="color: #fff;">Exercise Library</strong> for browsing or adding your own custom exercises.
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

              <!-- We'd love your ideas -->
              <div style="background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); border-left: 3px solid #ef4444; border-radius: 2px; padding: 24px 28px; margin: 32px 0 36px 0; box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);">
                <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0;">
                  We're always looking to improve the app. Let us know if you have any ideas you want incorporated — head to <strong style="color: #fff;">Profile &gt; Send Feedback</strong> and it goes straight to the dev team.
                </p>
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

const { rowCount } = await pool.query(
  `UPDATE email_templates SET subject = $1, html = $2, updated_at = NOW() WHERE name = 'welcome'`,
  [subject, html]
);

if (rowCount === 0) {
  // Insert if not present (defensive — should never happen on prod, but useful for fresh DBs)
  await pool.query(
    `INSERT INTO email_templates (name, subject, html, updated_at) VALUES ('welcome', $1, $2, NOW())`,
    [subject, html]
  );
  console.log('Inserted new welcome template row.');
} else {
  console.log('Updated welcome template row.');
}

console.log('Subject:', subject);
console.log('HTML length:', html.length, 'chars');
process.exit(0);
