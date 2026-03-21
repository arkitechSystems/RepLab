import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseCardTest from '../components/ExerciseCardTest';

const MOCK_EXERCISES = [
  {
    name: 'Bench Press',
    setType: 'straight',
    sets: [
      { setNumber: 1, plannedReps: 10, suggestedWeight: 185 },
      { setNumber: 2, plannedReps: 10, suggestedWeight: 185 },
      { setNumber: 3, plannedReps: 8, suggestedWeight: 205 },
    ],
  },
  {
    name: 'Incline Dumbbell Press',
    setType: 'straight',
    sets: [
      { setNumber: 1, plannedReps: 12, suggestedWeight: 60 },
      { setNumber: 2, plannedReps: 12, suggestedWeight: 60 },
      { setNumber: 3, plannedReps: 10, suggestedWeight: 65 },
    ],
  },
  {
    name: 'Cable Flyes',
    setType: 'drop',
    sets: [
      { setNumber: 1, plannedReps: 15, suggestedWeight: 30 },
      { setNumber: 2, plannedReps: 15, suggestedWeight: 30 },
      { setNumber: 3, plannedReps: 12, suggestedWeight: 35 },
    ],
  },
];

const MOCK_PBS = {
  'Bench Press': { 185: 12, 205: 8, 225: 5 },
  'Incline Dumbbell Press': { 60: 14, 65: 10 },
  'Cable Flyes': { 30: 18, 35: 12 },
};

export default function WorkoutSessionCardTest() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState({});
  const [completedSets, setCompletedSets] = useState(new Set());
  const [autoFilled] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [exercises, setExercises] = useState(MOCK_EXERCISES);

  const handleChange = (exerciseName, setIdx, field, value) => {
    setEntries(prev => ({
      ...prev,
      [exerciseName]: {
        ...(prev[exerciseName] || {}),
        [setIdx]: {
          ...(prev[exerciseName]?.[setIdx] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleToggleComplete = (exerciseName, setIdx) => {
    const key = `${exerciseName}-${setIdx}`;
    setCompletedSets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddSet = (exerciseName) => {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exerciseName) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [...ex.sets, {
          setNumber: ex.sets.length + 1,
          plannedReps: lastSet?.plannedReps || 10,
          suggestedWeight: lastSet?.suggestedWeight || 0,
        }],
      };
    }));
  };

  const handleDeleteSet = (exerciseName, setIdx) => {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exerciseName) return ex;
      return {
        ...ex,
        sets: ex.sets.filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 })),
      };
    }));
  };

  const handleNoteChange = (exerciseName, value) => {
    setNotes(prev => ({ ...prev, [exerciseName]: value }));
  };

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-2">Workout Session Card</h1>
      <p className="text-wf-gray-400 text-sm mb-6">Exercise card design playground</p>

      {exercises.map((ex) => (
        <ExerciseCardTest
          key={ex.name}
          exercise={ex}
          entries={entries[ex.name] || {}}
          pbs={MOCK_PBS}
          onChange={handleChange}
          onBlur={() => {}}
          readOnly={false}
          completedSets={completedSets}
          autoFilled={autoFilled}
          onToggleComplete={handleToggleComplete}
          onAddSet={handleAddSet}
          onDeleteSet={handleDeleteSet}
          note={notes[ex.name] || ''}
          onNoteChange={handleNoteChange}
        />
      ))}
    </div>
  );
}
