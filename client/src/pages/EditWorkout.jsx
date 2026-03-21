import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useExercises } from '../hooks/useExercises';
import { useUnsavedGuard } from '../components/UnsavedGuard';

const SET_TYPES = [
  { value: 'warm_up',      short: 'WU',   label: 'Warm Up' },
  { value: 'touch_up',     short: 'TU',   label: 'Touch Up' },
  { value: 'straight',     short: 'REG',  label: 'Regular' },
  { value: 'drop',         short: 'DS',   label: 'Drop Set' },
  { value: 'rest_pause',   short: 'RP',   label: 'Rest-Pause' },
  { value: 'superset',     short: 'SS',   label: 'Super Set' },
  { value: 'alternating',  short: 'Alt',  label: 'Alternating' },
  { value: 'giant',        short: 'Gia',  label: 'Giant Set' },
  { value: 'pre_exhaust',  short: 'PrEx', label: 'Pre-Exhaust' },
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
  const [activeAutocomplete, setActiveAutocomplete] = useState(null);
  const autocompleteRef = useRef(null);
  const { exercises: allExercises, createCustom } = useExercises();

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
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
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
          <div key={exIdx} className="glass-card rounded-xl overflow-hidden mb-3">
            {/* Exercise Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex-1 relative min-w-0" ref={activeAutocomplete === exIdx ? autocompleteRef : null}>
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
                  className="w-full bg-transparent text-base font-semibold text-white placeholder:text-wf-gray-500 focus:outline-none"
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
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all shrink-0 ml-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Set Controls Subheader */}
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium">
                {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addSet(exIdx)}
                  className="h-7 px-2.5 rounded-full bg-white/10 flex items-center justify-center gap-1 text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Add Set</span>
                </button>
                {ex.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(exIdx, ex.sets.length - 1)}
                    className="h-7 px-2.5 rounded-full bg-white/10 flex items-center justify-center gap-1 text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                    </svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* Column Headers */}
            <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[9px] text-wf-gray-500 uppercase tracking-wider">
              <div className="w-8 shrink-0 text-center">Set</div>
              <div className="w-14 shrink-0 text-center">Type</div>
              <div className="flex-1 text-center">Weight</div>
              <div className="flex-1 text-center">Reps</div>
            </div>

            {/* Set Rows */}
            <div className="divide-y divide-white/5">
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="px-3 py-2.5 flex items-center gap-1.5">
                  {/* Set label */}
                  <span className="text-wf-gray-400 text-xs font-medium w-8 shrink-0 text-center">
                    {setIdx + 1}
                  </span>

                  {/* Set type dropdown */}
                  <div className="w-14 shrink-0 relative">
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-wf-gray-400 uppercase pointer-events-none">
                      {SET_TYPES.find(t => t.value === ex.setType)?.short || 'REG'}
                    </span>
                    <select
                      value={ex.setType}
                      onChange={(e) => updateExercise(exIdx, 'setType', e.target.value)}
                      className="w-full h-10 bg-transparent text-transparent rounded-lg border border-white/5 focus:outline-none appearance-none cursor-pointer"
                    >
                      {SET_TYPES.map(t => (
                        <option key={t.value} value={t.value} className="bg-wf-gray-900 text-white text-sm">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Weight input */}
                  <div className="flex-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={set.weight || ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base text-white focus:outline-none"
                    />
                  </div>

                  {/* Reps input */}
                  <div className="flex-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={set.reps || ''}
                      onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base text-white focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
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
