import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { recordError, appFrame } from '../errorTracker.js';

const router = Router();
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

// Signed-in user id from the access token, or null. Only labels the report,
// so a missing/expired token just means "anonymous".
function userIdFrom(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    return Number.isInteger(decoded?.userId) ? decoded.userId : null;
  } catch {
    return null;
  }
}

// POST /errors/client — a browser/app crash for the admin Coding Errors page.
// body: { name, message, stack, page, origin, appVersion, kind?, route? }
// origin: 'window' | 'promise' | 'boundary' | 'api'. kind 'code' marks a
// failure the client knows isn't a network problem (e.g. fetch() rejecting
// its own arguments).
router.post('/client', async (req, res) => {
  const b = req.body || {};
  if (typeof b.message !== 'string' || !b.message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const stack = typeof b.stack === 'string' ? b.stack : null;
  // Minified bundle frames ("index-BIjqaHi7.js:32") change every build, so
  // they'd split one bug into a new group per deploy — group by page instead.
  const frame = appFrame(stack);
  const location = frame && !/-[A-Za-z0-9_]{8}\.js:/.test(frame) ? frame : null;
  await recordError({
    source: 'client',
    name: typeof b.name === 'string' ? b.name : 'Error',
    message: b.message,
    stack,
    location,
    route: typeof b.route === 'string' ? b.route : (typeof b.page === 'string' ? `page ${b.page.split('?')[0].replace(/\/\d[\w-]*/g, '/:n')}` : null),
    kind: b.kind === 'code' ? 'code' : undefined,
    context: typeof b.origin === 'string' ? `client ${b.origin}` : null,
    userId: userIdFrom(req),
    appVersion: typeof b.appVersion === 'string' ? b.appVersion : null,
  });
  res.status(204).end();
});

export default router;
