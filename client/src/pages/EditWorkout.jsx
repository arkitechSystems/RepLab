import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useUnsavedGuard } from '../components/UnsavedGuard';

const SET_TYPES = [
  { value: 'straight', label: 'Straight Set' },
  { value: 'drop', label: 'Drop Set' },
  { value: 'rest_pause', label: 'Rest Pause' },
  { value: 'pre_exhaust', label: 'Pre-Exhaust' },
  { value: 'sandwich', label: 'Sandwich' },
  { value: 'alternating', label: 'Alternating' },
];

export default function EditWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [originalData, setOriginalData] = useState(null);

  const isDirty = originalData !== null && JSON.stringify({ name, description, exercises }) !== originalData;
  const { guardedNavigate, UnsavedModal } = useUnsavedGuard({ isDirty });

  useEffect(() => {
    api('/templates')
      .then((templates) => {
        const tmpl = templates.find((t) => t.id === Number(id));
        if (!tmpl) {
          setError('Template not found');
          return;
        }
        setName(tmpl.name);
        setDescription(tmpl.description || '');
        const mappedExercises = tmpl.exercises.map((ex) => ({
          name: ex.name,
          setType: ex.setType || 'straight',
          sets: ex.sets.map((s) => ({ reps: s.plannedReps, weight: s.suggestedWeight })),
        }));
        setExercises(mappedExercises);
        setOriginalData(JSON.stringify({ name: tmpl.name, description: tmpl.description || '', exercises: mappedExercises }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function addExercise() {
    setExercises([...exercises, { name: '', setType: 'straight', sets: [{ reps: 10, weight: 0 }] }]);
  }

  function removeExercise(idx) {
    setExercises(exercises.filter((_, i) => i !== idx));
  }

  function updateExercise(idx, field, value) {
    const updated = [...exercises];
    updated[idx] = { ...updated[idx], [field]: value };
    setExercises(updated);
  }

  function addSet(exIdx) {
    const updated = [...exercises];
    updated[exIdx] = {
      ...updated[exIdx],
      sets: [...updated[exIdx].sets, { reps: 10, weight: 0 }],
    };
    setExercises(updated);
  }

  function updateSet(exIdx, setIdx, field, value) {
    const updated = [...exercises];
    updated[exIdx] = {
      ...updated[exIdx],
      sets: updated[exIdx].sets.map((s, i) =>
        i === setIdx ? { ...s, [field]: Number(value) || 0 } : s
      ),
    };
    setExercises(updated);
  }

  function removeSet(exIdx, setIdx) {
    const updated = [...exercises];
    updated[exIdx] = {
      ...updated[exIdx],
      sets: updated[exIdx].sets.filter((_, i) => i !== setIdx),
    };
    setExercises(updated);
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Workout name is required');
      return;
    }
    const validExercises = exercises.filter((e) => e.name.trim());
    if (validExercises.length === 0) {
      setError('Add at least one exercise');
      return;
    }

    setSaving(true);
    try {
      await api(`/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          exercises: validExercises,
        }),
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="glass-skeleton rounded-xl h-12 w-48 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-skeleton rounded-xl h-32 mb-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {UnsavedModal}
      <button onClick={() => guardedNavigate(() => navigate(-1))} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-3xl font-black text-white tracking-tight mb-6">Edit Workout</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Workout Name */}
      <div className="mb-4">
        <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Workout Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Upper Body"
          className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
        />
      </div>

      <div className="mb-6">
        <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Chest and Back focus"
          className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
        />
      </div>

      {/* Exercises */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-3">Exercises</h2>

        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className="glass-card rounded-xl p-4 mb-3">
            {/* Set Type */}
            <div className="mb-3">
              <label className="text-xs text-wf-gray-500 uppercase tracking-wider mb-2 block">Set Type</label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {SET_TYPES.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => updateExercise(exIdx, 'setType', st.value)}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                      ex.setType === st.value
                        ? 'bg-wf-red text-white'
                        : 'bg-white/5 text-wf-gray-400 border border-white/10'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercise Name */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={ex.name}
                onChange={(e) => updateExercise(exIdx, 'name', e.target.value)}
                placeholder="Exercise name"
                className="flex-1 glass-input rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
              />
              {exercises.length > 1 && (
                <button
                  onClick={() => removeExercise(exIdx)}
                  className="text-wf-gray-500 active:text-red-500 p-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sets */}
            {ex.sets.map((set, setIdx) => (
              <div key={setIdx} className="flex items-center gap-2 mb-2">
                <span className="text-wf-gray-400 text-xs w-10">Set {setIdx + 1}</span>
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                    placeholder="Reps"
                    className="w-full glass-input rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none transition-all"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.weight || ''}
                    onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                    placeholder="Weight"
                    className="w-full glass-input rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none transition-all"
                  />
                </div>
                {ex.sets.length > 1 && (
                  <button onClick={() => removeSet(exIdx, setIdx)} className="text-wf-gray-500 p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => addSet(exIdx)}
              className="text-wf-red text-xs font-medium mt-1 active:opacity-70"
            >
              + Add Set
            </button>
          </div>
        ))}

        <button
          onClick={addExercise}
          className="w-full border border-dashed border-white/15 rounded-xl py-3 text-wf-gray-400 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors"
        >
          + Add Exercise
        </button>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-4 rounded-xl text-base transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
