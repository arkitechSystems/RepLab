// Daily summary email to the admin, once per UTC day after 13:00 UTC.
//
// Runs every 10 minutes (backgroundJobs.js). The "already sent" date is kept
// in admin_settings, so restarts and repeat runs can't double-send. A failed
// send throws without recording the date, so the next run (or pg-boss's
// retry) tries again.

import db from './db.js';
import { sendDailySummaryEmail } from './email.js';

export const DAILY_SUMMARY_TARGET_UTC_HOUR = 13;
export const DAILY_SUMMARY_FLAG = 'daily_summary_last_sent_date';

// Returns what it did, for logs and tests: 'too-early', 'already-sent' or 'sent'.
export async function runDailySummary(now = new Date()) {
  const todayUTC = now.toISOString().slice(0, 10);
  if (now.getUTCHours() < DAILY_SUMMARY_TARGET_UTC_HOUR) return 'too-early';
  const lastSent = await db.getAdminSetting(DAILY_SUMMARY_FLAG);
  if (lastSent === todayUTC) return 'already-sent';
  const stats = await db.getDailyStats();
  await sendDailySummaryEmail(stats);
  await db.setAdminSetting(DAILY_SUMMARY_FLAG, todayUTC);
  console.log(`Daily summary sent for ${todayUTC}`);
  return 'sent';
}
