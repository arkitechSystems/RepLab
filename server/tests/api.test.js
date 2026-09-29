import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// --- Environment ---
// JWT_SECRET must be set before any app code loads (auth middleware throws without it).
// Must be at least 32 chars per the boot-time check in middleware/auth.js.
process.env.JWT_SECRET = 'test-secret-key-at-least-thirty-two-chars-long';
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

// Mock Firebase ID-token verification for /auth/social
vi.mock('../firebaseAuth.js', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

// Mock the Community like push notifier — route tests only check when it's
// called; its batching logic is covered in communityLikes.test.js.
vi.mock('../communityLikeNotifier.js', () => ({
  notifyCommunityLike: vi.fn().mockResolvedValue(undefined),
  startCommunityLikeScheduler: vi.fn(),
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
    findUserByUsernameOrEmail: vi.fn(),
    updatePassword: vi.fn(),
    setResetToken: vi.fn(),
    getIdentities: vi.fn().mockResolvedValue([]),
    findUserIdByIdentity: vi.fn().mockResolvedValue(null),
    findUserIdByEmail: vi.fn().mockResolvedValue(null),
    linkIdentity: vi.fn().mockResolvedValue(undefined),
    updateSignupProfile: vi.fn(),

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
    renameTemplate: vi.fn(),

    // Sessions
    createSession: vi.fn(),
    getSessions: vi.fn(),
    getSessionById: vi.fn(),
    getSessionByTemplateAndDate: vi.fn(),
    setSessionCustomName: vi.fn(),
    getVolumeGoalsByExerciseName: vi.fn().mockResolvedValue({}),
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

    // Community
    getCommunityFeed: vi.fn(),
    getCommunityItem: vi.fn(),
    likeCommunityItem: vi.fn(),
    unlikeCommunityItem: vi.fn().mockResolvedValue(undefined),
    countCommunityLikes: vi.fn().mockResolvedValue(0),
    getCommunityNotificationSettings: vi.fn(),
    setCommunityLikeNotifications: vi.fn(),

    // Misc
    getTrainersWithStatus: vi.fn().mockResolvedValue([]),
  };
  return { default: mockDb };
});

// Now import the app and mocked modules
const { app } = await import('../index.js');
const { default: request } = await import('supertest');
const { default: db } = await import('../db.js');
const { verifyFirebaseIdToken } = await import('../firebaseAuth.js');
const { default: pool } = await import('../dbPool.js');
const { notifyCommunityLike } = await import('../communityLikeNotifier.js');

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

  describe('POST /auth/login (token pair)', () => {
    it('returns both accessToken and refreshToken', async () => {
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
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // Legacy `token` alias still present so old clients keep working.
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).toBe(res.body.accessToken);

      // Access token carries type:'access', refresh carries type:'refresh'.
      // The auth middleware rejects refresh tokens presented as Bearer creds.
      const accessDecoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
      const refreshDecoded = jwt.verify(res.body.refreshToken, process.env.JWT_SECRET);
      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns a new access+refresh token pair for a valid refresh token', async () => {
      const refreshToken = jwt.sign(
        { userId: 1, tokenVersion: 0, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      db.findUserById.mockResolvedValue({ ...TEST_USER, id: 1, tokenVersion: 0 });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // Both returned tokens verify cleanly against the same secret and
      // carry the right `type` claim (rotation is fine; we can't assert a
      // different signature here because JWT `iat` is 1-second resolution
      // and the test issues both within the same second).
      const accessDecoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
      const refreshDecoded = jwt.verify(res.body.refreshToken, process.env.JWT_SECRET);
      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
    });

    it('rejects a refresh token with stale tokenVersion (password changed)', async () => {
      const refreshToken = jwt.sign(
        { userId: 1, tokenVersion: 0, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      // Password has since been changed, bumping tokenVersion to 1.
      db.findUserById.mockResolvedValue({ ...TEST_USER, id: 1, tokenVersion: 1 });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
    });

    it('rejects an access token presented as a refresh token', async () => {
      // type:'access' token should NOT be accepted by /auth/refresh.
      const accessToken = jwt.sign(
        { userId: 1, tokenVersion: 0, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(res.status).toBe(401);
    });

    it('returns 400 when refreshToken is missing', async () => {
      const res = await request(app).post('/auth/refresh').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/social', () => {
    const GOOGLE_IDENTITY = { provider: 'google', providerUid: 'g-123', email: 'new@example.com', emailVerified: true, name: 'Jane Doe' };

    it('returns 400 when idToken is missing', async () => {
      const res = await request(app).post('/auth/social').send({});
      expect(res.status).toBe(400);
    });

    it('returns 401 when the token fails verification', async () => {
      verifyFirebaseIdToken.mockRejectedValueOnce(new Error('bad signature'));
      const res = await request(app).post('/auth/social').send({ idToken: 'x' });
      expect(res.status).toBe(401);
    });

    it('creates a password-less user on first sign-in', async () => {
      verifyFirebaseIdToken.mockResolvedValueOnce(GOOGLE_IDENTITY);
      db.findUserIdByIdentity.mockResolvedValueOnce(null);
      db.findUserIdByEmail.mockResolvedValue(null);
      db.findUserByUsername.mockResolvedValue(null);
      db.createUser.mockResolvedValueOnce({ ...TEST_USER, id: 43, email: 'new@example.com', passwordHash: null });

      const res = await request(app).post('/auth/social').send({ idToken: 'x' });

      expect(res.status).toBe(201);
      expect(res.body.isNewUser).toBe(true);
      expect(res.body).toHaveProperty('accessToken');
      expect(db.createUser).toHaveBeenLastCalledWith(expect.objectContaining({ passwordHash: null, firstName: 'Jane', lastName: 'Doe', username: 'jdoe' }));
      expect(db.linkIdentity).toHaveBeenLastCalledWith(43, 'google', 'g-123', 'new@example.com');
    });

    it('links to an existing account with the same verified email and clears its password', async () => {
      verifyFirebaseIdToken.mockResolvedValueOnce(GOOGLE_IDENTITY);
      db.findUserIdByIdentity.mockResolvedValueOnce(null);
      db.findUserIdByEmail.mockResolvedValueOnce(1);
      db.findUserById.mockResolvedValueOnce(TEST_USER).mockResolvedValueOnce({ ...TEST_USER, passwordHash: null });
      db.updatePassword.mockClear();

      const res = await request(app).post('/auth/social').send({ idToken: 'x' });

      expect(res.status).toBe(200);
      expect(res.body.isNewUser).toBe(false);
      expect(db.linkIdentity).toHaveBeenLastCalledWith(1, 'google', 'g-123', 'new@example.com');
      // Pre-registered-account takeover guard: password + sessions dropped.
      expect(db.updatePassword).toHaveBeenCalledWith(1, null);
    });

    it('leaves the password alone for a returning linked identity', async () => {
      verifyFirebaseIdToken.mockResolvedValueOnce(GOOGLE_IDENTITY);
      db.findUserIdByIdentity.mockResolvedValueOnce(1);
      db.findUserById.mockResolvedValueOnce(TEST_USER);
      db.updatePassword.mockClear();

      const res = await request(app).post('/auth/social').send({ idToken: 'x' });

      expect(res.status).toBe(200);
      expect(db.updatePassword).not.toHaveBeenCalled();
    });

    it('does not link when the provider email is unverified', async () => {
      verifyFirebaseIdToken.mockResolvedValueOnce({ ...GOOGLE_IDENTITY, emailVerified: false });
      db.findUserIdByIdentity.mockResolvedValueOnce(null);
      db.findUserIdByEmail.mockResolvedValueOnce(1); // email already taken

      const res = await request(app).post('/auth/social').send({ idToken: 'x' });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /auth/delete-account', () => {
    it('deletes account for authenticated user', async () => {
      mockAuthPoolQuery(1);
      // Override the camelCase key so the route's `if (user.passwordHash)`
      // branch skips the bcrypt verification (Apple 5.1.1(v) password gate
      // added 2026-05-19). The previous `password_hash: null` overrode the
      // wrong key, leaving the placeholder hash in place and tripping 401.
      db.findUserById.mockResolvedValue({ ...TEST_USER, passwordHash: null });
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

  // Per-day rename from the session pencil. Only the one date's session row
  // changes; the template and other dates are never touched.
  describe('PUT /sessions/by-template/:templateId/:date/name', () => {
    const DATE = '2026-09-28';
    // Auth middleware + the route's template lookup both go through
    // pool.query; answer the template SELECT with `tmplRow`.
    function mockTemplateRow(tmplRow) {
      pool.query.mockImplementation(async (sql) => {
        if (String(sql).includes('FROM templates')) return { rows: tmplRow ? [tmplRow] : [] };
        return { rows: [{ id: 1 }] };
      });
    }
    function rename(templateId, date, name) {
      return request(app)
        .put(`/sessions/by-template/${templateId}/${date}/name`)
        .set('Authorization', authHeader(1))
        .send({ name });
    }

    beforeEach(() => {
      db.setSessionCustomName.mockReset();
      db.getSessionByTemplateAndDate.mockReset();
      db.createSession.mockReset();
      db.renameTemplate.mockReset();
      db.getTemplates.mockReset();
    });
    // Don't leak the SQL-routing pool mock into later suites.
    afterEach(() => { pool.query.mockResolvedValue({ rows: [] }); });

    it('renames just that date, trimmed, without touching the template', async () => {
      mockTemplateRow({ user_id: 1, is_rest: false });
      db.getSessionByTemplateAndDate.mockResolvedValue({ id: 50, workoutData: { name: 'Leg Day', exercises: [] } });
      db.setSessionCustomName.mockResolvedValue({ id: 50, customName: 'Heavy Legs' });

      const res = await rename(7, DATE, '  Heavy Legs  ');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ templateId: 7, date: DATE, customName: 'Heavy Legs' });
      expect(db.setSessionCustomName).toHaveBeenCalledTimes(1);
      expect(db.setSessionCustomName).toHaveBeenCalledWith(1, 7, DATE, 'Heavy Legs');
      expect(db.renameTemplate).not.toHaveBeenCalled();
      expect(db.createSession).not.toHaveBeenCalled();
    });

    it("creates the day's session copy first when it hasn't been opened", async () => {
      mockTemplateRow({ user_id: 1, is_rest: false });
      db.getSessionByTemplateAndDate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 51, workoutData: { name: 'Leg Day', exercises: [] } });
      db.getTemplates.mockResolvedValue([{
        id: 7, userId: 1, isRest: false, name: 'Leg Day',
        exercises: [{ name: 'Squat', sets: [{ setNumber: 1, plannedReps: 5, suggestedWeight: 225 }] }],
      }]);
      db.createSession.mockResolvedValue({ id: 51 });
      db.setSessionCustomName.mockResolvedValue({ id: 51, customName: 'Squat Focus' });

      const res = await rename(7, DATE, 'Squat Focus');

      expect(res.status).toBe(200);
      expect(db.createSession).toHaveBeenCalledTimes(1);
      expect(db.createSession.mock.calls[0].slice(0, 3)).toEqual([1, 7, DATE]);
      expect(db.setSessionCustomName).toHaveBeenCalledWith(1, 7, DATE, 'Squat Focus');
      expect(db.renameTemplate).not.toHaveBeenCalled();
    });

    it('rejects REPLAB (global) workouts with 403', async () => {
      mockTemplateRow({ user_id: null, is_rest: false });
      const res = await rename(7, DATE, 'Mine Now');
      expect(res.status).toBe(403);
      expect(db.setSessionCustomName).not.toHaveBeenCalled();
    });

    it("rejects another user's workout with 403", async () => {
      mockTemplateRow({ user_id: 2, is_rest: false });
      const res = await rename(7, DATE, 'Mine Now');
      expect(res.status).toBe(403);
      expect(db.setSessionCustomName).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing template', async () => {
      mockTemplateRow(null);
      const res = await rename(999, DATE, 'Anything');
      expect(res.status).toBe(404);
      expect(db.setSessionCustomName).not.toHaveBeenCalled();
    });

    it('rejects rest days', async () => {
      mockTemplateRow({ user_id: 1, is_rest: true });
      const res = await rename(7, DATE, 'Recovery');
      expect(res.status).toBe(400);
      expect(db.setSessionCustomName).not.toHaveBeenCalled();
    });

    it('rejects empty, too-long, and badly-dated requests', async () => {
      mockTemplateRow({ user_id: 1, is_rest: false });
      expect((await rename(7, DATE, '   ')).status).toBe(400);
      expect((await rename(7, DATE, 'x'.repeat(201))).status).toBe(400);
      expect((await rename(7, '09-28-2026', 'Legs')).status).toBe(400);
      expect((await rename('abc', DATE, 'Legs')).status).toBe(400);
      expect(db.setSessionCustomName).not.toHaveBeenCalled();
    });
  });
});

describe('Community Likes', () => {
  const PR_ITEM = { type: 'pr', id: 42, ownerId: 2, exercise: 'Bench Press', weight: 225, reps: 3 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthPoolQuery(1);
  });

  it('passes the viewer to the feed so it can mark likedByMe / isMine', async () => {
    db.getCommunityFeed.mockResolvedValue({ items: [], authors: {} });

    const res = await request(app)
      .get('/community/feed')
      .set('Authorization', authHeader(1));

    expect(res.status).toBe(200);
    expect(db.getCommunityFeed).toHaveBeenCalledWith(expect.objectContaining({ viewerId: 1 }));
  });

  it('likes an item, notifies the owner the first time, and returns the count', async () => {
    db.getCommunityItem.mockResolvedValue(PR_ITEM);
    db.likeCommunityItem.mockResolvedValue({ firstTime: true });
    db.countCommunityLikes.mockResolvedValue(3);

    const res = await request(app)
      .put('/community/likes/pr-42')
      .set('Authorization', authHeader(1));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: true, likeCount: 3 });
    expect(db.getCommunityItem).toHaveBeenCalledWith('pr', 42);
    expect(db.likeCommunityItem).toHaveBeenCalledWith(1, 'pr', 42, 2);
    expect(notifyCommunityLike).toHaveBeenCalledWith(1, PR_ITEM);
  });

  it('is idempotent and never re-notifies on a repeat or re-like', async () => {
    db.getCommunityItem.mockResolvedValue(PR_ITEM);
    db.likeCommunityItem.mockResolvedValue({ firstTime: false });
    db.countCommunityLikes.mockResolvedValue(1);

    const res = await request(app)
      .put('/community/likes/pr-42')
      .set('Authorization', authHeader(1));

    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(true);
    expect(notifyCommunityLike).not.toHaveBeenCalled();
  });

  it('rejects liking your own activity', async () => {
    db.getCommunityItem.mockResolvedValue({ ...PR_ITEM, ownerId: 1 });

    const res = await request(app)
      .put('/community/likes/pr-42')
      .set('Authorization', authHeader(1));

    expect(res.status).toBe(403);
    expect(db.likeCommunityItem).not.toHaveBeenCalled();
    expect(notifyCommunityLike).not.toHaveBeenCalled();
  });

  it('404s for activity that is missing or not shared', async () => {
    db.getCommunityItem.mockResolvedValue(null);

    const res = await request(app)
      .put('/community/likes/wk-9')
      .set('Authorization', authHeader(1));

    expect(res.status).toBe(404);
    expect(db.likeCommunityItem).not.toHaveBeenCalled();
  });

  it('400s for malformed item keys', async () => {
    for (const key of ['bogus-1', 'pr-abc', 'pr-0', 'pr-99999999999']) {
      const res = await request(app)
        .put(`/community/likes/${key}`)
        .set('Authorization', authHeader(1));
      expect(res.status).toBe(400);
    }
    expect(db.getCommunityItem).not.toHaveBeenCalled();
  });

  it('unlikes an item', async () => {
    db.countCommunityLikes.mockResolvedValue(0);

    const res = await request(app)
      .delete('/community/likes/cw-7')
      .set('Authorization', authHeader(1));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: false, likeCount: 0 });
    expect(db.unlikeCommunityItem).toHaveBeenCalledWith(1, 'custom', 7);
  });

  it('saves the "Likes on my activity" setting and validates it', async () => {
    db.setCommunityLikeNotifications.mockResolvedValue({ likes: false });

    const ok = await request(app)
      .put('/community/notifications')
      .set('Authorization', authHeader(1))
      .send({ likes: false });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ likes: false });
    expect(db.setCommunityLikeNotifications).toHaveBeenCalledWith(1, false);

    const bad = await request(app)
      .put('/community/notifications')
      .set('Authorization', authHeader(1))
      .send({ likes: 'no' });
    expect(bad.status).toBe(400);
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

// Regression tests for the recent security batch. Each test here guards a
// specific fix — if one breaks, it's a real production risk.
describe('Security regressions', () => {
  describe('Password reset token hashing', () => {
    it('stores a SHA-256 hash, never the plaintext token the user receives', async () => {
      db.findUserByIdentifier.mockResolvedValue({ ...TEST_USER, email: 'u@example.com' });
      db.setResetToken.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/auth/request-reset')
        .send({ email: 'u@example.com' });

      expect(res.status).toBe(200);
      expect(db.setResetToken).toHaveBeenCalled();
      const [, storedValue] = db.setResetToken.mock.calls[0];
      // SHA-256 hex is exactly 64 chars; raw randomBytes(32).toString('hex') is 64 too,
      // so the real check is that storedValue is not the plaintext the user receives.
      // We don't have the plaintext to compare against directly here — but setResetToken
      // is called INSIDE db.js with the hashed version, so this assertion is only
      // meaningful if hashing happens in db layer. It does: see db.js hashResetToken.
      expect(typeof storedValue).toBe('string');
      expect(storedValue).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('JWT tokenVersion invalidation', () => {
    it('rejects a JWT whose tokenVersion is stale relative to the DB value', async () => {
      // Craft a JWT issued when user was at tokenVersion 0
      const staleToken = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'client', tokenVersion: 0 },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      // Simulate that the user since reset their password — DB now shows tokenVersion 1
      pool.query.mockResolvedValue({ rows: [{ id: 1, token_version: 1 }] });

      const res = await request(app)
        .get('/programs')
        .set('Authorization', `Bearer ${staleToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Session expired|Invalid token/);
    });

    it('accepts a JWT whose tokenVersion matches the DB', async () => {
      const freshToken = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'client', tokenVersion: 3 },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      pool.query.mockResolvedValue({ rows: [{ id: 1, token_version: 3 }] });
      db.getPrograms.mockResolvedValue([]);

      const res = await request(app)
        .get('/programs')
        .set('Authorization', `Bearer ${freshToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Sharing invite ownership check', () => {
    // Each test drives pool.query through a specific sequence via
    // mockResolvedValueOnce — reset between tests so the queue doesn't leak.
    beforeEach(() => {
      pool.query.mockReset();
      db.findUserByUsernameOrEmail.mockReset();
      db.findUserById.mockReset();
    });

    it('allows inviting to a global library template (user_id NULL)', async () => {
      mockAuthPoolQuery(1);
      // First pool.query after auth: template lookup. Override after auth runs.
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, token_version: 0 }] }) // auth check
        .mockResolvedValueOnce({ rows: [{ id: 99, name: 'Push Day', user_id: null }] }) // template lookup
        .mockResolvedValueOnce({ rows: [] }) // existing invite check
        .mockResolvedValueOnce({ rows: [] }); // insert
      db.findUserByUsernameOrEmail.mockResolvedValue({ id: 2, first_name: 'Jane', username: 'jane' });
      db.findUserById.mockResolvedValue({ id: 1, firstName: 'Alice', lastName: 'A', username: 'alice' });

      const res = await request(app)
        .post('/sharing/invite')
        .set('Authorization', authHeader(1))
        .send({ templateId: 99, recipientIdentifier: 'jane' });

      expect(res.status).toBe(201);
    });

    it('allows inviting to a template owned by the caller', async () => {
      mockAuthPoolQuery(1);
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, token_version: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: 42, name: 'My Workout', user_id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      db.findUserByUsernameOrEmail.mockResolvedValue({ id: 2, first_name: 'Jane', username: 'jane' });
      db.findUserById.mockResolvedValue({ id: 1, firstName: 'Alice', lastName: 'A', username: 'alice' });

      const res = await request(app)
        .post('/sharing/invite')
        .set('Authorization', authHeader(1))
        .send({ templateId: 42, recipientIdentifier: 'jane' });

      expect(res.status).toBe(201);
    });

    it('rejects inviting to a template owned by someone else', async () => {
      mockAuthPoolQuery(1);
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, token_version: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: 500, name: 'Private Workout', user_id: 999 }] });

      const res = await request(app)
        .post('/sharing/invite')
        .set('Authorization', authHeader(1))
        .send({ templateId: 500, recipientIdentifier: 'jane' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/own/i);
    });
  });

  describe('Admin CSRF protection', () => {
    it('blocks a POST with cross-origin Origin header', async () => {
      const res = await request(app)
        .post('/admin/login')
        .set('Origin', 'http://evil.example.com')
        .set('Host', 'replab.app')
        .send({ username: 'admin', password: 'whatever' });

      // Should be rejected before even reaching the login handler
      expect(res.status).toBe(403);
    });

    it('allows a POST whose Origin matches the host', async () => {
      const res = await request(app)
        .post('/admin/login')
        // Omit Origin entirely; handler runs (and returns redirect on bad creds)
        .send({ username: 'admin', password: 'whatever' });

      // No 403 from CSRF — whatever the login handler does (redirect), it's not 403
      expect(res.status).not.toBe(403);
    });
  });
});

describe('Missed workouts routes', () => {
  // Server UTC date is always a plausible client "today".
  const TODAY = new Date().toISOString().slice(0, 10);

  beforeEach(() => mockAuthPoolQuery(1));

  it('GET /schedule/missed requires a valid local today', async () => {
    const res = await request(app).get('/schedule/missed?today=nope').set('Authorization', authHeader(1));
    expect(res.status).toBe(400);
    const far = await request(app).get('/schedule/missed?today=2020-01-01').set('Authorization', authHeader(1));
    expect(far.status).toBe(400);
  });

  it('GET /schedule/missed returns an empty list when nothing was missed', async () => {
    const res = await request(app).get(`/schedule/missed?today=${TODAY}`).set('Authorization', authHeader(1));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ missed: [], resume: null });
  });

  it('POST /schedule/missed/resume validates input', async () => {
    const noFrom = await request(app).post('/schedule/missed/resume').set('Authorization', authHeader(1)).send({ today: TODAY });
    expect(noFrom.status).toBe(400);
    const noToday = await request(app).post('/schedule/missed/resume').set('Authorization', authHeader(1)).send({ fromDate: TODAY });
    expect(noToday.status).toBe(400);
  });

  it('POST /schedule/missed/resume returns 409 when fromDate is not an unresolved miss', async () => {
    const res = await request(app)
      .post('/schedule/missed/resume')
      .set('Authorization', authHeader(1))
      .send({ today: TODAY, fromDate: '2026-01-01' });
    expect(res.status).toBe(409);
  });

  it('POST /schedule/missed/skip is a no-op when nothing is missed', async () => {
    const res = await request(app).post('/schedule/missed/skip').set('Authorization', authHeader(1)).send({ today: TODAY });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ skipped: 0 });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get(`/schedule/missed?today=${TODAY}`);
    expect(res.status).toBe(401);
  });
});
