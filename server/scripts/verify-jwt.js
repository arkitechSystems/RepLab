// Quick: takes a JWT and the local JWT_SECRET, runs jwt.verify, prints
// the same yes/no decision the auth middleware would make.
//
// Run: node --env-file=server/.env server/scripts/verify-jwt.js <token>
import jwt from 'jsonwebtoken';
import pool from '../dbPool.js';

const token = process.argv[2];
if (!token) {
  console.error('Usage: node server/scripts/verify-jwt.js <token>');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET not loaded — pass --env-file=server/.env');
  process.exit(1);
}

console.log(`JWT_SECRET length: ${process.env.JWT_SECRET.length}\n`);

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ Signature verified by local JWT_SECRET.\n');
  console.log('Payload:');
  console.log(JSON.stringify(decoded, null, 2));

  // Mirror the auth middleware check
  const { rows } = await pool.query(
    'SELECT id, token_version, role FROM users WHERE id = $1',
    [decoded.userId]
  );
  if (rows.length === 0) {
    console.log('\n❌ authMiddleware would 401: Account no longer exists');
  } else {
    const dbV = rows[0].token_version ?? 0;
    const jwtV = decoded.tokenVersion ?? 0;
    console.log(`\nDB user: id=${rows[0].id} role=${rows[0].role} token_version=${dbV}`);
    console.log(`JWT:     userId=${decoded.userId} tokenVersion=${jwtV}`);
    if (dbV !== jwtV) {
      console.log(`\n❌ authMiddleware would 401: tokenVersion mismatch (DB ${dbV} vs JWT ${jwtV})`);
    } else {
      console.log('\n✅ authMiddleware would PASS this token.');
    }
  }
} catch (err) {
  console.log(`❌ jwt.verify FAILED: ${err.name}: ${err.message}`);
  console.log('\nauthMiddleware would 401 with "Invalid token".');
  console.log('\nMost likely causes:');
  console.log('  - JWT_SECRET on the server differs from the one in this .env file');
  console.log('  - Token was signed with an old/rotated secret and never re-issued');
  console.log('  - Token was tampered with in transit');
}

process.exit(0);
