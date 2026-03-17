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
import db from './db.js';
import { sendDailySummaryEmail } from './email.js';

// In-memory error log for admin dashboard
export const errorLog = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Render uses 1 reverse proxy — trust only the first hop
const PORT = process.env.PORT || 3001;

// In production, client is served from same origin (no CORS needed)
// In development, allow Vite dev server
const corsOptions = process.env.NODE_ENV === 'production'
  ? {}
  : { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] };
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(sanitize); // Strip XSS from all request inputs

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
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

// API Routes
app.use('/auth', authRoutes);
app.use('/programs', programRoutes);
app.use('/templates', templateRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/sessions', sessionRoutes);
app.use('/pbs', pbRoutes);
app.use('/metrics', metricsRoutes);
app.use('/admin', adminRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/ai', aiRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve built client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
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
      console.log(`WillFit server running on http://localhost:${PORT}`);

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
