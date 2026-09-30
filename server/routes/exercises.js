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

// GET /exercises/muscles — list distinct muscle groups, most popular first
router.get('/muscles', authMiddleware, async (req, res) => {
  try {
    const muscles = await db.getMuscleGroupsByPopularity();
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

// PUT /exercises/:id/favorite — save an exercise (idempotent)
// DELETE /exercises/:id/favorite — unsave it (idempotent)
// 404 when the exercise doesn't exist or is another user's custom.
async function setFavorite(req, res, favorite) {
  try {
    const exerciseId = Number(req.params.id);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({ error: 'Invalid exercise id' });
    }
    const ok = await db.setExerciseFavorite(req.userId, exerciseId, favorite);
    if (!ok) return res.status(404).json({ error: 'Exercise not found' });
    res.json({ exerciseId, isFavorite: favorite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
router.put('/:id/favorite', authMiddleware, (req, res) => setFavorite(req, res, true));
router.delete('/:id/favorite', authMiddleware, (req, res) => setFavorite(req, res, false));

export default router;
