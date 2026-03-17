import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useExercises } from '../hooks/useExercises';
import { useUnsavedGuard } from '../components/UnsavedGuard';

const SET_TYPES = [
  { value: 'straight', label: 'Straight Set' },
  { value: 'drop', label: 'Drop Set' },
  { value: 'rest_pause', label: 'Rest Pause' },
  { value: 'pre_exhaust', label: 'Pre-Exhaust' },
  { value: 'sandwich', label: 'Sandwich' },
  { value: 'alternating', label: 'Alternating' },
];

export default function CreateWorkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedProgramId = searchParams.get('programId');
  const isQuickCreate = searchParams.get('quick') === '1';
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(preselectedProgramId || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([
    { name: '', setType: 'straight', sets: [{ reps: 10, weight: 0 }] },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [quickReady, setQuickReady] = useState(false);
  const [activeAutocomplete, setActiveAutocomplete] = useState(null); // exercise index or null
  const autocompleteRef = useRef(null);
  const [userPBs, setUserPBs] = useState([]); // all user PRs
  const [expandedPR, setExpandedPR] = useState(null); // exercise index showing PR picker

  const { exercises: allExercises, createCustom } = useExercises();

  // Build lookup: exercise name (lowercase) → PRs sorted by weight desc
  const prByExercise = {};
  for (const pb of userPBs) {
    const key = pb.exerciseName.toLowerCase();
    if (!prByExercise[key]) prByExercise[key] = [];
    prByExercise[key].push(pb);
  }
  for (const key of Object.keys(prByExercise)) {
    prByExercise[key].sort((a, b) => b.bestWeight - a.bestWeight);
  }

  function getPRsForExercise(exerciseName) {
    if (!exerciseName) return [];
    return prByExercise[exerciseName.toLowerCase()] || [];
  }

  // Get unique exercise names grouped by muscle
  function getSuggestions(query) {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    return allExercises
      .filter((ex) => {
        if (seen.has(ex.name)) return false;
        seen.add(ex.name);
        return ex.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Prioritize starts-with matches
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }

  const isDirty = name.trim() !== '' || description.trim() !== '' || exercises.some((e) => e.name.trim() !== '');
  const { guardedNavigate, UnsavedModal } = useUnsavedGuard({ isDirty });

  useEffect(() => {
    api('/pbs').then(setUserPBs).catch(console.error);
    api('/programs')
      .then(async (progs) => {
        setPrograms(progs);
        if (isQuickCreate) {
          // Find or create a "My Workouts" program for quick-create
          try {
            let quickProgram = progs.find((p) => p.name === 'My Workouts');
            if (!quickProgram) {
              quickProgram = await api('/programs', {
                method: 'POST',
                body: JSON.stringify({ name: 'My Workouts', description: 'Quick-created workouts' }),
              });
            }
            if (quickProgram?.id) {
              setSelectedProgramId(quickProgram.id);
              setQuickReady(true);
            } else {
              setError('Failed to set up quick create. Please try again.');
            }
          } catch (err) {
            setError('Failed to set up quick create: ' + err.message);
          }
        } else {
          if (!selectedProgramId && progs.length > 0) setSelectedProgramId(progs[0].id);
        }
      })
      .catch((err) => setError('Failed to load programs: ' + err.message));
  }, []);

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
    if (isQuickCreate && !quickReady) {
      setError('Setting up — try again in a moment');
      return;
    }
    if (!selectedProgramId) {
      setError('Select a program');
      return;
    }
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
      await api('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          exercises: validExercises,
          programId: Number(selectedProgramId),
        }),
      });
      // Auto-save any custom exercises not in the library
      const knownNames = new Set(allExercises.map(e => e.name.toLowerCase()));
      for (const ex of validExercises) {
        if (!knownNames.has(ex.name.toLowerCase())) {
          createCustom(ex.name, 'Other').catch(() => {});
        }
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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

      <h1 className="text-3xl font-black text-white tracking-tight mb-1">
        {isQuickCreate ? 'Quick Create' : 'Create Workout'}
      </h1>
      {isQuickCreate && (
        <p className="text-sm text-wf-gray-400 mb-6">
          Just name it, add exercises, and go. Saved to <span className="text-white font-medium">My Workouts</span>.
        </p>
      )}
      {!isQuickCreate && <div className="mb-6" />}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Program Picker — hidden in quick-create mode */}
      {!isQuickCreate && (
        <div className="mb-4">
          <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Add to Program</label>
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base bg-transparent focus:outline-none appearance-none cursor-pointer transition-all"
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id} className="bg-wf-gray-900">
                {p.name}
              </option>
            ))}
          </select>
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

            {/* Exercise Name with Autocomplete */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 relative" ref={activeAutocomplete === exIdx ? autocompleteRef : null}>
                <input
                  type="text"
                  value={ex.name}
                  onChange={(e) => {
                    updateExercise(exIdx, 'name', e.target.value);
                    setActiveAutocomplete(e.target.value.length >= 1 ? exIdx : null);
                  }}
                  onFocus={() => { if (ex.name.length >= 1) setActiveAutocomplete(exIdx); }}
                  onBlur={() => { setTimeout(() => setActiveAutocomplete(null), 150); }}
                  placeholder="Exercise name"
                  className="w-full glass-input rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                />
                {activeAutocomplete === exIdx && getSuggestions(ex.name).length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-wf-gray-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden max-h-64 overflow-y-auto">
                    {getSuggestions(ex.name).map((suggestion) => (
                      <button
                        key={suggestion.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          updateExercise(exIdx, 'name', suggestion.name);
                          setActiveAutocomplete(null);
                        }}
                        className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors"
                      >
                        <span className="text-sm text-white">{suggestion.name}</span>
                        <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider ml-2 shrink-0">{suggestion.muscle}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

            {/* PR suggestions */}
            {getPRsForExercise(ex.name).length > 0 && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setExpandedPR(expandedPR === exIdx ? null : exIdx)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 active:opacity-70 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
                  </svg>
                  {getPRsForExercise(ex.name).length} PR{getPRsForExercise(ex.name).length !== 1 ? 's' : ''} recorded — tap to use
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${expandedPR === exIdx ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {expandedPR === exIdx && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 px-1 mb-1">
                      <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600">Weight</span>
                      <span className="w-12 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Reps</span>
                      <span className="w-16 text-[10px] uppercase tracking-widest text-wf-gray-600 text-right">Date</span>
                      <span className="w-8" />
                    </div>
                    {getPRsForExercise(ex.name).map((pr) => (
                      <div
                        key={pr.id}
                        className="flex items-center gap-2 px-1"
                      >
                        <span className="flex-1 text-sm font-mono-stat text-amber-400">{pr.bestWeight} lbs</span>
                        <span className="w-12 text-sm font-mono-stat text-white/80 text-center">&times; {pr.bestReps}</span>
                        <span className="w-16 text-[10px] text-wf-gray-500 text-right">
                          {new Date(pr.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            // Apply this PR to all sets in this exercise
                            const updated = [...exercises];
                            updated[exIdx] = {
                              ...updated[exIdx],
                              sets: updated[exIdx].sets.map((s) => ({
                                ...s,
                                weight: pr.bestWeight,
                                reps: pr.bestReps,
                              })),
                            };
                            setExercises(updated);
                            setExpandedPR(null);
                          }}
                          className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 active:bg-amber-500/30 transition-colors"
                        >
                          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    inputMode="decimal"
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
          {saving ? 'Saving...' : 'Create Workout'}
        </button>
      </div>
    </div>
  );
}
