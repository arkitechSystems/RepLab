import { describe, it, expect, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

// --- Environment ---
// JWT_SECRET must be set before any app code loads (auth middleware throws without it)
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

// --- Module mocks ---
// These must be hoisted before any imports that depend on them.

// Mock the PostgreSQL pool — used directly by auth middleware, routes, and email
vi.mock('../dbPool.js', () => {
  const mockPool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }),
    on: vi.fn(),
  };
  return { default: mockPool };
});

// Mock initDb so the app doesn't try to run migrations
vi.mock('../initDb.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

// Mock email module — no-op all email functions
vi.mock('../email.js', () => ({
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendNewSignupNotification: vi.fn(),
  sendDailySummaryEmail: vi.fn(),
}));

// Mock Sentry so it doesn't initialize
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

// Mock Stripe so billing route doesn't throw
vi.mock('../stripe.js', () => ({
  default: vi.fn().mockReturnValue({
    checkout: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { cancel: vi.fn() },
  }),
}));

// Mock db module with fake implementations for all methods used by routes
vi.mock('../db.js', () => {
  const mockDb = {
    // Users
    findUserByIdentifier: vi.fn(),
    findUserByUsername: vi.fn(),
    findUserById: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    setDefaultSchedule: vi.fn().mockResolvedValue(undefined),
    getAllUsers: vi.fn().mockResolvedValue([]),
    findUserByResetToken: vi.fn(),
    updatePassword: vi.fn(),
    setResetToken: vi.fn(),

    // Programs
    getPrograms: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    deleteProgram: vi.fn(),

    // Templates
    getTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),

    // Sessions
    createSession: vi.fn(),
    getSessions: vi.fn(),
    getSessionById: vi.fn(),
    getSessionByTemplateAndDate: vi.fn(),
    getBestPerformanceByTemplate: vi.fn(),

    // Schedule
    getSchedule: vi.fn(),
    setSchedule: vi.fn(),

    // PBs
    getPersonalBests: vi.fn(),

    // Metrics
    getMetrics: vi.fn(),
    updateMetrics: vi.fn(),

    // Admin
    getAdminSetting: vi.fn(),
    setAdminSetting: vi.fn(),
    getDailyStats: vi.fn(),

    // Misc
    getTrainersWithStatus: vi.fn().mockResolvedValue([]),
  };
  return { default: mockDb };
});

// Now import the app and mocked modules
const { app } = await import('../index.js');
const { default: request } = await import('supertest');
const { default: db } = await import('../db.js');
const { default: pool } = await import('../dbPool.js');

// --- Helpers ---

const TEST_USER = {
  id: 1,
  email: 'test@example.com',
  phone: null,
  firstName: 'Test',
  lastName: 'User',
  username: 'tuser',
  passwordHash: '$2a$10$xJ8Kx0JZ1Z7qJ9x7q1Z7qO1Z7q1Z7q1Z7q1Z7q1Z7q1Z7q1Z7q', // placeholder
  role: 'client',
  plan: 'Free',
  trialEnd: null,
  profilePhoto: null,
  password_hash: null,
};

function makeToken(userId = 1) {
  return jwt.sign(
    { userId, email: 'test@example.com', phone: null, role: 'client' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function authHeader(userId = 1) {
  return `Bearer ${makeToken(userId)}`;
}

// The auth middleware does a pool.query to verify user exists — mock it for authed requests
function mockAuthPoolQuery(userId = 1) {
  pool.query.mockResolvedValue({ rows: [{ id: userId }] });
}

// --- Tests ---

describe('Auth Routes', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('returns 201 with token for valid input', async () => {
      db.findUserByIdentifier.mockResolvedValue(null); // no existing user
      db.findUserByUsername.mockResolvedValue(null); // username available
      db.createUser.mockResolvedValue({ ...TEST_USER, id: 42 });
      db.setDefaultSchedule.mockResolvedValue(undefined);
      db.getAllUsers.mockResolvedValue([{ id: 42 }]);

      const res = await request(app)
        .post('/auth/signup')
        .send({
          identifier: 'new@example.com',
          password: 'StrongPass1',
          firstName: 'Jane',
          lastName: 'Doe',
          zipCode: '02101',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(typeof res.body.token).toBe('string');
    });

    it('returns 400 for missing identifier', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ password: 'StrongPass1' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ identifier: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for weak password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          identifier: 'test@example.com',
          password: 'weak',
          firstName: 'A',
          lastName: 'B',
          zipCode: '00000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Password must have/);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with token for valid credentials', async () => {
      // bcryptjs.hashSync('StrongPass1', 10) — pre-compute a real hash
      const bcrypt = await import('bcryptjs');
      const hash = bcrypt.hashSync('StrongPass1', 10);

      db.findUserByIdentifier.mockResolvedValue({
        ...TEST_USER,
        passwordHash: hash,
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'test@example.com', password: 'StrongPass1' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
    });

    it('returns 401 for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = bcrypt.hashSync('CorrectPass1', 10);

      db.findUserByIdentifier.mockResolvedValue({
        ...TEST_USER,
        passwordHash: hash,
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'test@example.com', password: 'WrongPass1' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 401 for non-existent user', async () => {
      db.findUserByIdentifier.mockResolvedValue(null);

      const res = await request(app)
        .post('/auth/login')
        .send({ identifier: 'nobody@example.com', password: 'SomePass1' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /auth/delete-account', () => {
    it('deletes account for authenticated user', async () => {
      mockAuthPoolQuery(1);
      db.findUserById.mockResolvedValue({ ...TEST_USER, password_hash: null });
      db.deleteUser.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', authHeader(1))
        .send({ password: 'anything' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Account deleted');
      expect(db.deleteUser).toHaveBeenCalledWith(1);
    });

    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .delete('/auth/delete-account')
        .send({ password: 'anything' });

      expect(res.status).toBe(401);
    });
  });
});

describe('Program Routes', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe('GET /programs', () => {
    it('returns array of programs for authenticated user', async () => {
      mockAuthPoolQuery(1);
      const mockPrograms = [
        { id: 1, name: 'Push Pull Legs', description: '' },
        { id: 2, name: 'Upper Lower', description: '' },
      ];
      db.getPrograms.mockResolvedValue(mockPrograms);

      const res = await request(app)
        .get('/programs')
        .set('Authorization', authHeader(1));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Push Pull Legs');
    });

    it('returns 401 without auth header', async () => {
      const res = await request(app).get('/programs');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/programs')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid token');
    });
  });

  describe('POST /programs', () => {
    it('creates a program and returns 201', async () => {
      mockAuthPoolQuery(1);
      const newProgram = { id: 10, name: 'New Program', description: 'Test' };
      db.createProgram.mockResolvedValue(newProgram);

      const res = await request(app)
        .post('/programs')
        .set('Authorization', authHeader(1))
        .send({ name: 'New Program', description: 'Test' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Program');
      expect(db.createProgram).toHaveBeenCalledWith(1, 'New Program', 'Test');
    });

    it('returns 400 for missing program name', async () => {
      mockAuthPoolQuery(1);

      const res = await request(app)
        .post('/programs')
        .set('Authorization', authHeader(1))
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Program name is required');
    });
  });

  describe('DELETE /programs/:id', () => {
    it('deletes a program and returns success', async () => {
      mockAuthPoolQuery(1);
      db.deleteProgram.mockResolvedValue({ id: 5 });

      const res = await request(app)
        .delete('/programs/5')
        .set('Authorization', authHeader(1));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(db.deleteProgram).toHaveBeenCalledWith(1, 5);
    });

    it('returns 404 when program not found', async () => {
      mockAuthPoolQuery(1);
      db.deleteProgram.mockResolvedValue(null);

      const res = await request(app)
        .delete('/programs/999')
        .set('Authorization', authHeader(1));

      expect(res.status).toBe(404);
    });
  });
});

describe('Template Routes', () => {
  describe('GET /templates', () => {
    it('returns array of templates for authenticated user', async () => {
      mockAuthPoolQuery(1);
      const mockTemplates = [
        { id: 1, name: 'Chest Day', programId: 1, exercises: [] },
      ];
      db.getTemplates.mockResolvedValue(mockTemplates);

      const res = await request(app)
        .get('/templates')
        .set('Authorization', authHeader(1));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('Chest Day');
    });

    it('returns 401 without auth header', async () => {
      const res = await request(app).get('/templates');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /templates', () => {
    it('creates a template and returns 201', async () => {
      mockAuthPoolQuery(1);
      const newTemplate = { id: 5, name: 'Leg Day', programId: 1 };
      db.createTemplate.mockResolvedValue(newTemplate);

      const res = await request(app)
        .post('/templates')
        .set('Authorization', authHeader(1))
        .send({ name: 'Leg Day', programId: 1 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Leg Day');
    });

    it('returns 400 for missing template name', async () => {
      mockAuthPoolQuery(1);

      const res = await request(app)
        .post('/templates')
        .set('Authorization', authHeader(1))
        .send({ programId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Template name is required');
    });
  });
});

describe('Session Routes', () => {
  describe('POST /sessions', () => {
    it('saves a session and returns 201', async () => {
      mockAuthPoolQuery(1);
      const mockSession = {
        id: 100,
        templateId: 1,
        date: '2026-04-04',
        entries: [{ exerciseName: 'Bench Press', setNumber: 1, weight: 135, reps: 10 }],
      };
      db.createSession.mockResolvedValue(mockSession);

      const res = await request(app)
        .post('/sessions')
        .set('Authorization', authHeader(1))
        .send({
          templateId: 1,
          date: '2026-04-04',
          entries: [{ exerciseName: 'Bench Press', setNumber: 1, weight: 135, reps: 10 }],
          notes: 'Good session',
          workoutData: {},
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(100);
    });

    it('returns 400 for missing required fields', async () => {
      mockAuthPoolQuery(1);

      const res = await request(app)
        .post('/sessions')
        .set('Authorization', authHeader(1))
        .send({ templateId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .post('/sessions')
        .send({ templateId: 1, date: '2026-04-04', entries: [{}] });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /sessions', () => {
    it('returns array of sessions for authenticated user', async () => {
      mockAuthPoolQuery(1);
      db.getSessions.mockResolvedValue([
        { id: 1, templateId: 1, date: '2026-04-01' },
        { id: 2, templateId: 2, date: '2026-04-02' },
      ]);

      const res = await request(app)
        .get('/sessions')
        .set('Authorization', authHeader(1));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });
});

describe('Health Check', () => {
  it('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});
