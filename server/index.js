import * as Sentry from '@sentry/node';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import sanitize from './middleware/sanitize.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize Sentry for server-side error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    enabled: process.env.NODE_ENV === 'production',
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
  });
}
import initDb from './initDb.js';
import authRoutes from './routes/auth.js';
import programRoutes from './routes/programs.js';
import templateRoutes from './routes/templates.js';
import scheduleRoutes from './routes/schedule.js';
import sessionRoutes from './routes/sessions.js';
import pbRoutes from './routes/pbs.js';
import metricsRoutes from './routes/metrics.js';
import adminRoutes from './routes/admin.js';
import feedbackRoutes from './routes/feedback.js';
import aiRoutes from './routes/ai.js';
import exerciseRoutes from './routes/exercises.js';
import challengeRoutes from './routes/challenges.js';
import trainerRoutes from './routes/trainer.js';
import billingRoutes from './routes/billing.js';
import shopRoutes from './routes/shop.js';
import workoutDashboardRoutes from './routes/workoutDashboard.js';
import sharingRoutes from './routes/sharing.js';
import pushRoutes from './routes/push.js';
import feedReactionsRoutes from './routes/feedReactions.js';
import db from './db.js';
import { sendDailySummaryEmail } from './email.js';
import { startIdleReminderScheduler } from './pushScheduler.js';
import { startStreakReminderScheduler } from './streakReminderScheduler.js';

// In-memory error log for admin dashboard
export const errorLog = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Render uses 1 reverse proxy — trust only the first hop
const PORT = process.env.PORT || 3024;

// In production, client is served from same origin (no CORS needed)
// In development, allow Vite dev server
const corsOptions = process.env.NODE_ENV === 'production'
  ? {}
  : { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] };
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.originalUrl === '/billing/webhook') {
    express.raw({ type: 'application/json', limit: '1mb' })(req, res, next);
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});
app.use(cookieParser());
app.use(sanitize); // Strip XSS from all request inputs

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Disabled in favor of CSP; legacy header can cause issues
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // Content Security Policy. Skipped on /admin and /trainer because those
    // are server-rendered pages with inline <style> + <script> blocks that
    // would trip strict CSP. The user-facing SPA gets the policy below.
    //
    // Allowed sources, with reason:
    //   - 'self' for same-origin assets
    //   - data: + blob: for canvas-generated PR share cards (prShare.js) and
    //     base64 profile photos
    //   - https://*.stripe.com for Stripe checkout/redirect
    //   - https://*.youtube.com / *.ytimg.com for the feed's video embeds + thumbnails
    //   - https://*.posthog.com for analytics
    //   - https://*.ingest.sentry.io for error reporting
    //   - https://i.ytimg.com (specifically) for thumbnails
    //   - 'unsafe-inline' on style — required by Tailwind's runtime-injected styles
    //     and inline style attributes; can be tightened with nonces later.
    if (!req.path.startsWith('/admin') && !req.path.startsWith('/trainer')) {
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://*.stripe.com https://js.stripe.com https://*.youtube.com https://*.posthog.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https: ",
        "media-src 'self' blob: https:",
        "connect-src 'self' https://*.stripe.com https://*.posthog.com https://*.ingest.sentry.io https://*.sentry.io https://ip-api.com https://api.resend.com https://api.anthropic.com",
        "frame-src https://*.stripe.com https://js.stripe.com https://*.youtube.com https://www.youtube-nocookie.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://*.stripe.com",
        "frame-ancestors 'none'",
      ].join('; '));
    }
  }
  next();
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 15 : 100, // higher limit in dev
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // higher limit in dev
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI endpoints are expensive (Anthropic API cost per call). Cap per IP to
// stop scripted abuse — unauthenticated hits are already blocked by auth
// middleware, but an authenticated attacker could still rack up the bill.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { error: 'AI rate limit hit. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply strict limiter to auth endpoints (login, signup, reset)
app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);
app.use('/auth/request-reset', authLimiter);
app.use('/admin/login', authLimiter);
// Refresh limiter is keyed on the refresh token (hashed) rather than IP.
// Per-token = effectively per-user-per-device, which is what we want — a heavy
// multi-device user behind a shared IP (coffee shop / VPN / family) won't get
// throttled by another user's traffic. A valid refresh token is required, so
// this endpoint is not an auth-bypass surface.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  message: { error: 'Too many refresh attempts. Please log in again.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.body?.refreshToken;
    if (typeof token === 'string' && token.length > 10) {
      return 'rf:' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
    }
    return 'ip:' + ipKeyGenerator(req);
  },
});
app.use('/auth/refresh', refreshLimiter);
// Data export is expensive (many joined queries) and nothing legitimate runs
// it more than a handful of times per day — cap it aggressively.
app.use('/auth/export-data', rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  message: { error: 'Too many export requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Universal Link / App Link discovery files. Both iOS and Android verify
// these endpoints are reachable (no auth, plain JSON, no redirect) before
// they'll route external HTTPS links into the app.
//
// PRE-LAUNCH TODO (tied to audit B1 — bundle ID):
//   1. Replace TEAMID with your Apple Developer Team ID (App Store Connect →
//      Membership). Example: ABCD1234XY.
//   2. Replace `com.willfit.app` with the final bundle ID once B1 is decided.
//   3. Replace the Android sha256_cert_fingerprints placeholder with the
//      SHA-256 of your release signing key. Generate with:
//        keytool -list -v -keystore your-upload-key.keystore | grep SHA256
//      (Or grab it from Play Console → App signing → App signing key
//      certificate.)
//   4. Confirm the AndroidManifest <data android:host="..."/> entries match
//      your real hosts.
app.get('/.well-known/apple-app-site-association', (_req, res) => {
  res.type('application/json').json({
    applinks: {
      apps: [],
      details: [{
        // TODO: TEAMID + final bundle ID — see audit B1.
        appID: 'TEAMID.com.willfit.app',
        paths: [
          '/session/*',
          '/featured-session/*',
          '/exercises/*',
          '/history/*',
        ],
      }],
    },
  });
});

app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.type('application/json').json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      // TODO: final bundle ID — see audit B1.
      package_name: 'com.willfit.app',
      sha256_cert_fingerprints: [
        // TODO: paste the SHA-256 of your Android release signing key.
        '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
      ],
    },
  }]);
});

// Apply general limiter to all API routes
app.use('/programs', apiLimiter);
app.use('/templates', apiLimiter);
app.use('/schedule', apiLimiter);
app.use('/sessions', apiLimiter);
app.use('/pbs', apiLimiter);
app.use('/metrics', apiLimiter);
app.use('/feedback', apiLimiter);
app.use('/exercises', apiLimiter);
app.use('/challenges', apiLimiter);
app.use('/ai', aiLimiter);

// API Routes
app.use('/auth', authRoutes);
app.use('/programs', programRoutes);
app.use('/templates', templateRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/sessions', sessionRoutes);
app.use('/pbs', pbRoutes);
app.use('/metrics', metricsRoutes);
app.use('/admin', adminRoutes);
app.use('/trainer', trainerRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/ai', aiRoutes);
app.use('/exercises', exerciseRoutes);
app.use('/challenges', challengeRoutes);
app.use('/billing', billingRoutes);
app.use('/shop', shopRoutes);
app.use('/workouts', workoutDashboardRoutes);
app.use('/sharing', apiLimiter, sharingRoutes);
app.use('/push', pushRoutes);
app.use('/feed/reactions', apiLimiter, feedReactionsRoutes);

// Health check — pinged by UptimeRobot to prevent Render free-tier sleep
app.get('/health', (req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Serve exercise demo videos
app.use('/videos', express.static(path.join(__dirname, 'VidLib')));

// Serve built client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
// Catch-all for React SPA — skip server-rendered pages (/admin, /trainer)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/trainer') || req.path.startsWith('/workouts')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error capture middleware — stores last 50 errors in memory for admin dashboard + Sentry
app.use((err, req, res, next) => {
  errorLog.unshift({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  if (errorLog.length > 50) errorLog.length = 50;
  // Report to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: { method: req.method, url: req.originalUrl } });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export { app };

// Initialize database then start server (skip when imported for testing)
if (process.env.NODE_ENV !== 'test') {
  initDb()
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`RepLab server running on http://localhost:${PORT}`);

        // Daily summary email heartbeat. Replaces a fragile recursive setTimeout
        // that was lost on every server restart and silently dropped the day's
        // send if Resend hit an error. This polls every 10 minutes and fires
        // once per UTC day once the target hour has passed. The "already sent"
        // flag is persisted in admin_settings so restarts can't double-send,
        // and failed sends don't update the flag → automatic retry next tick.
        const DAILY_SUMMARY_TARGET_UTC_HOUR = 13; // 13:00 UTC, honestly labeled
        const DAILY_SUMMARY_FLAG = 'daily_summary_last_sent_date';
        const HEARTBEAT_MS = 10 * 60 * 1000;

        async function tickDailySummary() {
          try {
            const now = new Date();
            const todayUTC = now.toISOString().slice(0, 10);
            if (now.getUTCHours() < DAILY_SUMMARY_TARGET_UTC_HOUR) return;
            const lastSent = await db.getAdminSetting(DAILY_SUMMARY_FLAG);
            if (lastSent === todayUTC) return;
            const stats = await db.getDailyStats();
            await sendDailySummaryEmail(stats);
            // Only record success. A thrown error here means the flag is NOT
            // updated, and the next heartbeat will retry within ~10 min.
            await db.setAdminSetting(DAILY_SUMMARY_FLAG, todayUTC);
            console.log(`Daily summary sent for ${todayUTC}`);
          } catch (err) {
            console.error('Daily summary tick failed (will retry):', err.message);
          }
        }

        tickDailySummary();
        setInterval(tickDailySummary, HEARTBEAT_MS);

        // Idle-session push reminders. Dormant until FCM_SERVICE_ACCOUNT_JSON is set.
        startIdleReminderScheduler();
        // Streak-protection reminder. Same dormancy rule.
        startStreakReminderScheduler();
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}
