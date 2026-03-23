export function getWeightSuggestion(
  history: { date: string; sets: { setNumber: number; weight: number; reps: number }[] }[],
  goalReps: number
): { weight: number; direction: 'up' | 'hold' | 'down'; reason: string } | null {
  if (!history || history.length === 0) return null;
  const lastSession = history[0];
  if (!lastSession.sets || lastSession.sets.length === 0) return null;

  const weights = lastSession.sets.map(s => s.weight);
  const weightCounts: Record<number, number> = {};
  for (const w of weights) {
    weightCounts[w] = (weightCounts[w] || 0) + 1;
  }
  const lastWeight = Number(
    Object.entries(weightCounts).sort((a, b) => b[1] - a[1])[0][0]
  );

  const setsAtWeight = lastSession.sets.filter(s => s.weight === lastWeight);
  const avgReps =
    setsAtWeight.reduce((sum, s) => sum + s.reps, 0) / setsAtWeight.length;
  const goal = goalReps || 10;
  const increment = lastWeight >= 100 ? 5 : 2.5;

  if (avgReps >= goal) {
    return {
      weight: lastWeight + increment,
      direction: 'up',
      reason: `Hit ${Math.round(avgReps)} reps last time`,
    };
  } else if (avgReps >= goal - 2) {
    return {
      weight: lastWeight,
      direction: 'hold',
      reason: `Almost there — ${Math.round(avgReps)}/${goal} reps`,
    };
  } else {
    return {
      weight: Math.max(0, lastWeight - increment),
      direction: 'down',
      reason: `Only ${Math.round(avgReps)}/${goal} reps last time`,
    };
  }
}
