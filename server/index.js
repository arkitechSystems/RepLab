import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import sanitize from './middleware/sanitize.js';
import path from 'path';
import { fileURLToPath } from 'url';
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
import db from './db.js';
import { sendDailySummaryEmail } from './email.js';

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
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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

// Apply strict limiter to auth endpoints (login, signup, reset)
app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);
app.use('/auth/request-reset', authLimiter);
app.use('/admin/login', authLimiter);

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

// Health check — pinged by UptimeRobot to prevent Render free-tier sleep
app.get('/health', (req, res) => res.json({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

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

// Error capture middleware — stores last 50 errors in memory for admin dashboard
app.use((err, req, res, next) => {
  errorLog.unshift({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  if (errorLog.length > 50) errorLog.length = 50;
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database then start server
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`RepLab server running on http://localhost:${PORT}`);

      // Daily summary email scheduler — runs at 8am ET every day
      function scheduleDailySummary() {
        const now = new Date();
        // Target 8:00 AM ET (UTC-5 / UTC-4 depending on DST)
        const target = new Date(now);
        target.setUTCHours(13, 0, 0, 0); // 13:00 UTC = 8:00 AM ET
        if (target <= now) target.setDate(target.getDate() + 1);
        const ms = target - now;
        console.log(`Daily summary scheduled in ${Math.round(ms / 60000)} minutes`);
        setTimeout(async () => {
          try {
            const stats = await db.getDailyStats();
            await sendDailySummaryEmail(stats);
          } catch (err) {
            console.error('Daily summary error:', err.message);
          }
          // Schedule next one
          scheduleDailySummary();
        }, ms);
      }
      scheduleDailySummary();
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
