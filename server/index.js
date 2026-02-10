import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import templateRoutes from './routes/templates.js';
import scheduleRoutes from './routes/schedule.js';
import sessionRoutes from './routes/sessions.js';
import pbRoutes from './routes/pbs.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/templates', templateRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/sessions', sessionRoutes);
app.use('/pbs', pbRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`WillFit server running on http://localhost:${PORT}`);
});
