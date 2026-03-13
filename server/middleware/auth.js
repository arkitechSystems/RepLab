import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'willfit-dev-secret';

export function generateToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
