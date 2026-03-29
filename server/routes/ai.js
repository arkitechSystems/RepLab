import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db.js';

const router = Router();

router.post('/generate-workout', authMiddleware, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI workout generation is not configured' });
  }

  try {
    const { goal, experience, equipment, duration, muscleGroups, notes } = req.body;

    if (!goal || !experience) {
      return res.status(400).json({ error: 'Goal and experience level are required' });
    }

    // Fetch user's PRs for context
    let prContext = '';
    try {
      const pbs = await db.getPBs(req.userId);
      if (pbs.length > 0) {
        const topPBs = pbs.slice(0, 20).map(pb =>
          `${pb.exerciseName}: ${pb.bestWeight} lbs x ${pb.bestReps} reps`
        ).join('\n');
        prContext = `\n\nThe user's current personal records:\n${topPBs}`;
      }
    } catch {}

    const prompt = `You are a certified personal trainer creating a workout for a user of the RepLab fitness app.

User Profile:
- Goal: ${goal}
- Experience Level: ${experience}
- Available Equipment: ${equipment || 'Full gym'}
- Workout Duration: ${duration || '45-60'} minutes
- Target Muscle Groups: ${muscleGroups || 'Full body'}
${notes ? `- Additional Notes: ${notes}` : ''}
${prContext}

Create a complete workout with exercises, sets, reps, and suggested weights. Use the personal records to suggest appropriate weights (typically 70-85% of PR weight for working sets).

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{
  "name": "Workout name",
  "description": "Brief description",
  "exercises": [
    {
      "name": "Exercise Name",
      "setType": "straight",
      "sets": [
        { "reps": 10, "weight": 135 },
        { "reps": 10, "weight": 135 },
        { "reps": 8, "weight": 155 }
      ]
    }
  ]
}

Rules:
- Use common exercise names from a standard gym
- Include 5-8 exercises
- Each exercise should have 3-4 sets
- Set weights to 0 if no PR data exists for that exercise
- setType should be "straight" for most exercises, "drop" for drop sets
- Match the workout to the user's goal and experience level
- For beginners, use lighter weights and higher reps (12-15)
- For intermediate, use moderate weights and moderate reps (8-12)
- For advanced, include heavier sets and varied rep ranges (5-12)`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';

    // Log usage — Haiku pricing: $0.25/M input, $1.25/M output
    const inputTokens = message.usage?.input_tokens || 0;
    const outputTokens = message.usage?.output_tokens || 0;
    const costCents = (inputTokens * 0.000025) + (outputTokens * 0.000125);
    try {
      await db.logAIUsage(req.userId, inputTokens, outputTokens, 'claude-haiku-4-5', Math.round(costCents * 10000) / 10000);
    } catch {}

    // Parse JSON from response
    let workout;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      workout = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('AI response parse error:', parseErr.message, 'Response:', text);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    // Validate structure
    if (!workout.name || !workout.exercises || !Array.isArray(workout.exercises)) {
      return res.status(500).json({ error: 'AI generated an invalid workout. Please try again.' });
    }

    res.json(workout);
  } catch (err) {
    console.error('AI generation error:', err.status, err.message, err.error || '');
    if (err.status === 429) {
      return res.status(429).json({ error: 'Too many AI requests. Please wait a moment and try again.' });
    }
    res.status(500).json({ error: 'Failed to generate workout. Please try again.' });
  }
});

router.post('/edit-workout', authMiddleware, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured' });
  }

  try {
    const { workout, instruction } = req.body;

    if (!workout || !instruction) {
      return res.status(400).json({ error: 'Workout and instruction are required' });
    }

    const prompt = `You are a certified personal trainer helping edit a workout in the RepLab fitness app.

Current workout:
${JSON.stringify(workout, null, 2)}

User's instruction: "${instruction}"

Apply the user's requested changes to the workout. Keep everything else the same unless the instruction implies otherwise.

IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
{
  "name": "Workout name",
  "description": "Brief description",
  "exercises": [
    {
      "name": "Exercise Name",
      "setType": "straight",
      "sets": [
        { "reps": 10, "weight": 135 }
      ]
    }
  ]
}

Rules:
- Apply the user's changes precisely
- "drop set" means setType should be "drop"
- "superset" means setType should be "superset"
- Keep all unchanged exercises exactly as they are
- When adding sets, match the weight/rep pattern of existing sets
- When removing exercises, keep the rest in order
- Return the complete workout, not just the changed parts`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';

    const inputTokens = message.usage?.input_tokens || 0;
    const outputTokens = message.usage?.output_tokens || 0;
    const costCents = (inputTokens * 0.000025) + (outputTokens * 0.000125);
    try {
      await db.logAIUsage(req.userId, inputTokens, outputTokens, 'claude-haiku-4-5', Math.round(costCents * 10000) / 10000);
    } catch {}

    let result;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    if (!result.name || !result.exercises || !Array.isArray(result.exercises)) {
      return res.status(500).json({ error: 'AI generated an invalid workout. Please try again.' });
    }

    res.json(result);
  } catch (err) {
    console.error('AI edit error:', err.status, err.message);
    if (err.status === 429) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }
    res.status(500).json({ error: 'Failed to edit workout. Please try again.' });
  }
});

router.post('/suggest-swap', authMiddleware, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured' });
  }

  try {
    const { exerciseName, reason, currentWorkoutExercises } = req.body;

    if (!exerciseName) {
      return res.status(400).json({ error: 'exerciseName is required' });
    }

    const avoidList = (currentWorkoutExercises || []).filter(n => n !== exerciseName);

    const prompt = `You are a certified personal trainer helping a user of the RepLab fitness app swap an exercise mid-workout.

The user wants to replace: "${exerciseName}"
${reason ? `Reason: ${reason}` : 'Reason: equipment unavailable'}
${avoidList.length > 0 ? `Already in this workout (avoid duplicates): ${avoidList.join(', ')}` : ''}

Suggest exactly 3 alternative exercises. Each should:
1. Target the same primary muscle group
2. Use different equipment than the original (since it may be taken)
3. Not duplicate any exercise already in the workout

IMPORTANT: Respond ONLY with valid JSON, no other text:
{
  "suggestions": [
    { "name": "Exercise Name", "reason": "Brief explanation of why this is a good substitute" },
    { "name": "Exercise Name", "reason": "Brief explanation" },
    { "name": "Exercise Name", "reason": "Brief explanation" }
  ]
}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';

    const inputTokens = message.usage?.input_tokens || 0;
    const outputTokens = message.usage?.output_tokens || 0;
    const costCents = (inputTokens * 0.000025) + (outputTokens * 0.000125);
    try {
      await db.logAIUsage(req.userId, inputTokens, outputTokens, 'claude-haiku-4-5', Math.round(costCents * 10000) / 10000);
    } catch {}

    let result;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      return res.status(500).json({ error: 'AI generated an invalid response. Please try again.' });
    }

    res.json(result);
  } catch (err) {
    console.error('AI swap error:', err.status, err.message);
    if (err.status === 429) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }
    res.status(500).json({ error: 'Failed to generate suggestions. Please try again.' });
  }
});

export default router;
