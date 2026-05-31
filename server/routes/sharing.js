import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db.js';
import pool from '../dbPool.js';

const router = Router();

// Search users for share picker. An empty query returns the first 25 users
// alphabetically by username so the picker can render a default list as soon
// as the modal opens (and the user can refine by typing). Excludes the
// requesting user and demo accounts, capped at 25 results — the LIMIT plus
// no-pagination contract is what keeps this from becoming a directory-scrape
// surface even with the empty-query case allowed.
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    // ILIKE '%%' matches any non-null value; combined with the LIMIT 25 below
    // this returns the first page of users alphabetically when q is empty.
    const pattern = `%${q}%`;
    const { rows } = await pool.query(
      // Match on username, email, OR the user's display name (first + last).
      // Email is checked server-side only — it stays out of the response
      // payload below, so searchers can find a user by typing their email
      // without ever seeing other users' email addresses on the wire.
      // ORDER BY username ASC so the share picker reads alphabetically by
      // handle; nulls come last under PostgreSQL's default ASC sort.
      `SELECT id, username, first_name, last_name, profile_photo
       FROM users
       WHERE id != $1
         AND (email NOT LIKE '%@willfit.demo' OR email IS NULL)
         AND (
              username ILIKE $2
           OR email ILIKE $2
           OR (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE $2
         )
       ORDER BY username ASC NULLS LAST
       LIMIT 25`,
      [req.userId, pattern]
    );
    res.json(rows.map(r => ({
      id: r.id,
      username: r.username || '',
      name: r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : r.first_name || r.username || 'User',
      photo: r.profile_photo || null,
    })));
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a share
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { programId, recipientIdentifier } = req.body;
    if (!programId || !recipientIdentifier) {
      return res.status(400).json({ error: 'Program and recipient are required' });
    }

    // Verify program belongs to sender
    const { rows: progRows } = await pool.query('SELECT id FROM programs WHERE id = $1 AND user_id = $2', [programId, req.userId]);
    if (progRows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    // Find recipient
    const recipient = await db.findUserByUsernameOrEmail(recipientIdentifier);
    if (!recipient) {
      return res.status(404).json({ error: 'User not found. Check the username, email, or phone number and try again.' });
    }
    if (recipient.id === req.userId) {
      return res.status(400).json({ error: "You can't share a program with yourself" });
    }

    // Check for existing pending share of same program to same user
    const { rows: existing } = await pool.query(
      "SELECT id FROM shared_programs WHERE source_program_id = $1 AND recipient_id = $2 AND status = 'pending'",
      [programId, recipient.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'You already shared this program with this user' });
    }

    await db.createShare(req.userId, recipient.id, programId);
    res.status(201).json({ success: true, recipientName: recipient.first_name || recipient.username });
  } catch (err) {
    console.error('Share send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending shares for current user
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const shares = await db.getPendingShares(req.userId);
    res.json(shares);
  } catch (err) {
    console.error('Pending shares error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept a share or invite
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    // Check if this is an invite or a program share
    const { rows: shareRows } = await pool.query(
      "SELECT type, template_id FROM shared_programs WHERE id = $1 AND recipient_id = $2 AND status = 'pending'",
      [id, req.userId]
    );
    if (shareRows.length === 0) return res.status(404).json({ error: 'Share not found' });

    if (shareRows[0].type === 'invite') {
      // For invites, just mark as accepted and return template info
      await pool.query("UPDATE shared_programs SET status = 'accepted' WHERE id = $1", [id]);
      const { rows: tmplRows } = await pool.query('SELECT id, name FROM templates WHERE id = $1', [shareRows[0].template_id]);
      res.json({ success: true, type: 'invite', template: tmplRows[0] || null });
    } else {
      const result = await db.acceptShare(id, req.userId);
      res.json({ success: true, type: 'program', program: result });
    }
  } catch (err) {
    console.error('Accept share error:', err);
    res.status(400).json({ error: 'Failed to accept share' });
  }
});

// Decline a share
router.post('/:id/decline', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const ok = await db.declineShare(id, req.userId);
    if (!ok) return res.status(404).json({ error: 'Share not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Decline share error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a workout invite (browse library workouts)
router.post('/invite', authMiddleware, async (req, res) => {
  try {
    const { templateId, recipientIdentifier } = req.body;
    if (!templateId || !recipientIdentifier) {
      return res.status(400).json({ error: 'Workout and recipient are required' });
    }

    // Verify template exists AND the sender is allowed to share it. Global
    // library templates have user_id NULL and can be shared by anyone; a
    // user-owned template can only be shared by its owner. Without this check,
    // any authenticated user could enumerate template IDs and invite other
    // users to private templates they don't own.
    const { rows: tmplRows } = await pool.query('SELECT id, name, user_id FROM templates WHERE id = $1', [templateId]);
    if (tmplRows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    const { name: templateName, user_id: ownerId } = tmplRows[0];
    if (ownerId !== null && ownerId !== req.userId) {
      return res.status(403).json({ error: "You can only share workouts you own or from the library" });
    }

    // Find recipient
    const recipient = await db.findUserByUsernameOrEmail(recipientIdentifier);
    if (!recipient) {
      return res.status(404).json({ error: 'User not found. Check the username, email, or phone number and try again.' });
    }
    if (recipient.id === req.userId) {
      return res.status(400).json({ error: "You can't invite yourself" });
    }

    // Get sender name
    const sender = await db.findUserById(req.userId);
    const senderName = sender.firstName && sender.lastName
      ? `${sender.firstName} ${sender.lastName}`
      : sender.firstName || sender.username || 'Someone';

    const message = `${senderName} is doing ${templateName} today and wants you to join. Check it out!`;

    // Check for existing pending invite of same template to same user
    const { rows: existing } = await pool.query(
      "SELECT id FROM shared_programs WHERE template_id = $1 AND recipient_id = $2 AND status = 'pending' AND type = 'invite'",
      [templateId, recipient.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'You already invited this user to this workout' });
    }

    await pool.query(
      "INSERT INTO shared_programs (sender_id, recipient_id, template_id, type, message) VALUES ($1, $2, $3, 'invite', $4)",
      [req.userId, recipient.id, templateId, message]
    );

    res.status(201).json({ success: true, recipientName: recipient.first_name || recipient.username });
  } catch (err) {
    console.error('Invite send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get accepted shares map (programId → sender info)
router.get('/accepted', authMiddleware, async (req, res) => {
  try {
    const map = await db.getAcceptedShares(req.userId);
    res.json(map);
  } catch (err) {
    console.error('Accepted shares error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
