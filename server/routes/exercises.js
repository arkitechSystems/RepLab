import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /exercises — search/filter exercises
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, muscle, limit } = req.query;
    const exercises = await db.getExercises(req.userId, {
      search,
      muscle,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(exercises);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /exercises/muscles — list distinct muscle groups
router.get('/muscles', authMiddleware, async (req, res) => {
  try {
    const muscles = await db.getMuscleGroups();
    res.json(muscles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /exercises — create custom exercise
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, muscleGroup, tags } = req.body;
    if (!name || !muscleGroup) {
      return res.status(400).json({ error: 'Name and muscle group are required' });
    }
    const exercise = await db.createExercise(req.userId, name.trim(), muscleGroup, tags || []);
    res.status(201).json(exercise);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
