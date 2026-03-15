import express from 'express';
import cors from 'cors';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true); // Render runs behind a proxy — needed for real IP
const PORT = process.env.PORT || 3001;

// In production, client is served from same origin (no CORS needed)
// In development, allow Vite dev server
const corsOptions = process.env.NODE_ENV === 'production'
  ? {}
  : { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] };
app.use(cors(corsOptions));
app.use(express.json());

// API Routes
app.use('/auth', authRoutes);
app.use('/programs', programRoutes);
app.use('/templates', templateRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/sessions', sessionRoutes);
app.use('/pbs', pbRoutes);
app.use('/metrics', metricsRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve built client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Initialize database then start server
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`WillFit server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
