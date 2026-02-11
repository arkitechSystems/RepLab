import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import templateRoutes from './routes/templates.js';
import scheduleRoutes from './routes/schedule.js';
import sessionRoutes from './routes/sessions.js';
import pbRoutes from './routes/pbs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// API Routes
app.use('/auth', authRoutes);
app.use('/templates', templateRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/sessions', sessionRoutes);
app.use('/pbs', pbRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve built client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WillFit server running on http://localhost:${PORT}`);
});
