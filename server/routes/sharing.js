import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db.js';
import pool from '../dbPool.js';

const router = Router();

// Get all users for share picker (lightweight — excludes current user and demo accounts)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, first_name, last_name, profile_photo
       FROM users
       WHERE id != $1 AND (email NOT LIKE '%@willfit.demo' OR email IS NULL)
       ORDER BY first_name, username`,
      [req.userId]
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

    // Verify template exists
    const { rows: tmplRows } = await pool.query('SELECT id, name FROM templates WHERE id = $1', [templateId]);
    if (tmplRows.length === 0) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    const templateName = tmplRows[0].name;

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
