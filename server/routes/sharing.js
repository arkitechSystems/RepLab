import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db.js';
import pool from '../dbPool.js';

const router = Router();

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

// Accept a share
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const result = await db.acceptShare(id, req.userId);
    res.json({ success: true, program: result });
  } catch (err) {
    console.error('Accept share error:', err);
    res.status(400).json({ error: err.message || 'Failed to accept share' });
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
