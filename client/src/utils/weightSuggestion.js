/**
 * Compute a smart weight suggestion based on exercise history.
 * @param {Array} history - Array of { date, sets: [{ setNumber, weight, reps }] } sorted newest first
 * @param {number} goalReps - The planned reps from the template
 * @returns {null | { weight: number, direction: 'up'|'hold'|'down', reason: string }}
 */
export function getWeightSuggestion(history, goalReps) {
  if (!history || history.length === 0) return null;

  const lastSession = history[0];
  if (!lastSession.sets || lastSession.sets.length === 0) return null;

  // Use the most common weight from last session (mode)
  const weights = lastSession.sets.map(s => s.weight);
  const weightCounts = {};
  for (const w of weights) {
    weightCounts[w] = (weightCounts[w] || 0) + 1;
  }
  const lastWeight = Number(Object.entries(weightCounts).sort((a, b) => b[1] - a[1])[0][0]);

  // Check how reps compared to goal across all sets at that weight
  const setsAtWeight = lastSession.sets.filter(s => s.weight === lastWeight);
  const avgReps = setsAtWeight.reduce((sum, s) => sum + s.reps, 0) / setsAtWeight.length;
  const goal = goalReps || 10;

  const increment = lastWeight >= 100 ? 5 : 2.5;

  if (avgReps >= goal) {
    // Hit or exceeded goal — suggest moving up
    return {
      weight: lastWeight + increment,
      direction: 'up',
      reason: `Hit ${Math.round(avgReps)} reps last time`,
    };
  } else if (avgReps >= goal - 2) {
    // Close to goal — hold steady
    return {
      weight: lastWeight,
      direction: 'hold',
      reason: `Almost there — ${Math.round(avgReps)}/${goal} reps`,
    };
  } else {
    // Missed significantly — suggest dropping
    return {
      weight: Math.max(0, lastWeight - increment),
      direction: 'down',
      reason: `Only ${Math.round(avgReps)}/${goal} reps last time`,
    };
  }
}
