import xss from 'xss';

/**
 * Recursively sanitize all string values in an object to prevent XSS.
 * Strips HTML tags and dangerous attributes from user input.
 */
function sanitizeValue(val) {
  if (typeof val === 'string') {
    return xss(val, {
      whiteList: {}, // no HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    const cleaned = {};
    for (const key of Object.keys(val)) {
      cleaned[key] = sanitizeValue(val[key]);
    }
    return cleaned;
  }
  return val;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
export default function sanitize(req, res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}
