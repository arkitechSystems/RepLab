// Diagnostic: for the given user(s), print everything authMiddleware
// looks at — id, email, role, plan, token_version — so we can spot why
// freshly-issued JWTs are getting rejected on the API.
//
// Run: node --env-file=server/.env server/scripts/diagnose-401-by-user.js [email-or-username] [email-or-username] ...
//
// Pass any number of identifiers (emails OR usernames). Output highlights
// any row whose token_version != 0 — those are the accounts whose JWT
// must carry a matching version or every API call 401s.
import pool from '../dbPool.js';

const identifiers = process.argv.slice(2);
if (identifiers.length === 0) {
  console.error('Usage: node server/scripts/diagnose-401-by-user.js <email-or-username> [more...]');
  process.exit(1);
}

console.log('Auth-relevant fields for each user:\n');

for (const id of identifiers) {
  const { rows } = await pool.query(
    `SELECT id, email, phone, username, role, plan, token_version, created_at
       FROM users
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
      LIMIT 1`,
    [id]
  );
  if (rows.length === 0) {
    console.log(`  ${id}  →  NOT FOUND`);
    continue;
  }
  const u = rows[0];
  const flag = (u.token_version ?? 0) === 0 ? '' : '  ← token_version != 0 (every JWT must match this)';
  console.log(`  id=${u.id}  username=${u.username || '(none)'}  email=${u.email || '(none)'}  role=${u.role}  plan=${u.plan}  token_version=${u.token_version}${flag}`);
}

console.log('');
console.log('Also: rows where token_version > 0 across the whole users table:');
const { rows: bumped } = await pool.query(
  `SELECT id, username, email, role, plan, token_version
     FROM users
    WHERE token_version > 0
    ORDER BY token_version DESC, id ASC
    LIMIT 20`
);
if (bumped.length === 0) {
  console.log('  (none — everyone is at token_version = 0)');
} else {
  for (const u of bumped) {
    console.log(`  id=${u.id}  username=${u.username || '(none)'}  email=${u.email || '(none)'}  role=${u.role}  plan=${u.plan}  token_version=${u.token_version}`);
  }
}

process.exit(0);
