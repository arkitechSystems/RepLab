import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useExercises } from '../hooks/useExercises';
import { useUnsavedGuard } from '../components/UnsavedGuard';
import ExerciseCard from '../components/ExerciseCard';

export default function EditWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [originalData, setOriginalData] = useState(null);
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
        const mappedExercises = tmpl.exercises.map((ex) => {
          if (ex.isSectionHeader) return { name: ex.name, isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: [] };
          return {
            name: ex.name,
            nameConfirmed: true,
            setType: ex.setType || 'straight',
            sets: ex.sets.map((s) => ({ reps: s.plannedReps, weight: s.suggestedWeight })),
          };
        });
        setExercises(mappedExercises);
        setOriginalData(JSON.stringify({ name: tmpl.name, description: tmpl.description || '', exercises: mappedExercises }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function addExercise() {
    setExercises([...exercises, { name: '', nameConfirmed: false, setType: 'straight', sets: [{ reps: 10, weight: 0 }] }]);
  }

  function addSectionHeader() {
    setExercises([...exercises, { name: '', isSectionHeader: true, sectionNotes: '', sets: [] }]);
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

  // Build exercise object format for ExerciseCard
  function toCardExercise(ex) {
    return {
      name: ex.name,
      setType: ex.setType,
      sets: ex.sets.map((s, i) => ({ setNumber: i + 1 })),
    };
  }

  // Build entries array for ExerciseCard
  function toCardEntries(ex) {
    return ex.sets.map((s) => ({
      weight: s.weight || '',
      reps: s.reps || '',
      setType: ex.setType,
    }));
  }

  // Handle onChange from ExerciseCard
  function handleCardChange(exIdx) {
    return (_exerciseName, setIdx, field, value) => {
      if (field === 'setType') {
        updateExercise(exIdx, 'setType', value);
      } else {
        updateSet(exIdx, setIdx, field, value);
      }
    };
  }

  function handleSwapExercise(exIdx) {
    return (_oldName, newName) => {
      updateExercise(exIdx, 'name', newName);
    };
  }

  function handleAddExerciseBelow(exIdx) {
    return (newName) => {
      const updated = [...exercises];
      updated.splice(exIdx + 1, 0, { name: newName, nameConfirmed: !!newName, setType: 'straight', sets: [{ reps: 10, weight: 0 }] });
      setExercises(updated);
    };
  }

  function handleMoveUp(exIdx) {
    if (exIdx <= 0) return null;
    return () => {
      const updated = [...exercises];
      [updated[exIdx - 1], updated[exIdx]] = [updated[exIdx], updated[exIdx - 1]];
      setExercises(updated);
    };
  }

  function handleMoveDown(exIdx) {
    if (exIdx >= exercises.length - 1) return null;
    return () => {
      const updated = [...exercises];
      [updated[exIdx], updated[exIdx + 1]] = [updated[exIdx + 1], updated[exIdx]];
      setExercises(updated);
    };
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Workout name is required');
      return;
    }
    const validExercises = exercises.filter((e) => e.name.trim());
    const hasRealExercise = validExercises.some(e => !e.isSectionHeader);
    if (!hasRealExercise) {
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
        if (ex.isSectionHeader) continue;
        if (!knownNames.has(ex.name.toLowerCase())) {
          createCustom(ex.name, 'Other').catch(() => {});
        }
      }
      const from = searchParams.get('from');
      if (from === 'trainer') { window.location.href = '/trainer/workouts'; }
      else if (from === 'admin') { window.location.href = '/admin/workout-manager/workouts'; }
      else { navigate('/'); }
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
      <button onClick={() => guardedNavigate(() => {
        const from = searchParams.get('from');
        if (from === 'trainer') { window.location.href = '/trainer/workouts'; }
        else if (from === 'admin') { window.location.href = '/admin/workout-manager/workouts'; }
        else { navigate(-1); }
      })} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {searchParams.get('from') === 'trainer' ? 'Back to Dashboard' : searchParams.get('from') === 'admin' ? 'Back to Admin' : 'Back'}
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
          <TemplateExerciseWrapper
            key={exIdx}
            ex={ex}
            exIdx={exIdx}
            exercises={exercises}
            allExercises={allExercises}
            updateExercise={updateExercise}
            toCardExercise={toCardExercise}
            toCardEntries={toCardEntries}
            handleCardChange={handleCardChange}
            addSet={addSet}
            removeSet={removeSet}
            removeExercise={removeExercise}
            handleSwapExercise={handleSwapExercise}
            handleAddExerciseBelow={handleAddExerciseBelow}
            handleMoveUp={handleMoveUp}
            handleMoveDown={handleMoveDown}
          />
        ))}

        <div className="flex gap-2">
          <button
            onClick={addExercise}
            className="flex-1 border border-dashed border-white/15 rounded-xl py-3 text-wf-gray-400 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors"
          >
            + Add Exercise
          </button>
          <button
            onClick={addSectionHeader}
            className="flex-1 border border-dashed border-wf-red/30 rounded-xl py-3 text-wf-red/60 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors"
          >
            + Add Section
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
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

/**
 * Wrapper component that renders an exercise name input with autocomplete,
 * then delegates the set table to ExerciseCard in template mode.
 */
function TemplateExerciseWrapper({
  ex, exIdx, exercises, allExercises,
  updateExercise, toCardExercise, toCardEntries, handleCardChange,
  addSet, removeSet, removeExercise,
  handleSwapExercise, handleAddExerciseBelow, handleMoveUp, handleMoveDown,
}) {
  const [activeAutocomplete, setActiveAutocomplete] = useState(false);
  const autocompleteRef = useRef(null);

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

  // Section header — editable card
  if (ex.isSectionHeader) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-r from-wf-red/10 via-transparent to-transparent mb-3">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-wf-red shrink-0" />
          <span className="text-[9px] text-wf-red uppercase tracking-widest font-bold shrink-0">Section</span>
          <input
            type="text"
            value={ex.name}
            onChange={(e) => updateExercise(exIdx, 'name', e.target.value)}
            placeholder="Section name"
            className="flex-1 bg-transparent text-sm font-black text-white uppercase tracking-wide placeholder:text-wf-gray-500 placeholder:font-medium placeholder:normal-case placeholder:tracking-normal focus:outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            {handleMoveUp(exIdx) && (
              <button onClick={handleMoveUp(exIdx)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
              </button>
            )}
            {handleMoveDown(exIdx) && (
              <button onClick={handleMoveDown(exIdx)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
            )}
            <button
              onClick={() => removeExercise(exIdx)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="px-4 pb-3 pl-8">
          <div className="ml-0.5 pl-3 border-l border-white/10">
            <input
              type="text"
              value={ex.sectionNotes || ''}
              onChange={(e) => updateExercise(exIdx, 'sectionNotes', e.target.value)}
              placeholder="Section notes (optional)"
              className="w-full bg-transparent text-xs text-wf-gray-400 leading-relaxed placeholder:text-wf-gray-600 focus:outline-none"
            />
          </div>
        </div>
      </div>
    );
  }

  // If name not yet confirmed, show the search input card with autocomplete
  if (!ex.nameConfirmed) {
    const suggestions = getSuggestions(ex.name);
    const hasExactMatch = suggestions.some(s => s.name.toLowerCase() === ex.name.toLowerCase());
    return (
      <div className="glass-card rounded-xl overflow-hidden mb-3">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex-1 relative min-w-0" ref={activeAutocomplete ? autocompleteRef : null}>
            <input
              type="text"
              value={ex.name}
              onChange={(e) => {
                updateExercise(exIdx, 'name', e.target.value);
                setActiveAutocomplete(e.target.value.length >= 1);
              }}
              onFocus={() => { if (ex.name.length >= 1) setActiveAutocomplete(true); }}
              onBlur={() => { setTimeout(() => setActiveAutocomplete(false), 150); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ex.name.trim()) {
                  e.preventDefault();
                  updateExercise(exIdx, 'nameConfirmed', true);
                  setActiveAutocomplete(false);
                }
              }}
              placeholder="Search exercises..."
              autoFocus
              className="w-full bg-transparent text-base font-semibold text-white placeholder:text-wf-gray-500 focus:outline-none"
            />
            {activeAutocomplete && (suggestions.length > 0 || ex.name.trim().length > 0) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-wf-gray-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      updateExercise(exIdx, 'name', suggestion.name);
                      updateExercise(exIdx, 'nameConfirmed', true);
                      setActiveAutocomplete(false);
                    }}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    <span className="text-sm text-white">{suggestion.name}</span>
                    <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider ml-2 shrink-0">{suggestion.muscle}</span>
                  </button>
                ))}
                {!hasExactMatch && ex.name.trim() && (
                  <>
                    <div className="border-t border-white/5" />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateExercise(exIdx, 'nameConfirmed', true);
                        setActiveAutocomplete(false);
                      }}
                      className="w-full text-left px-3 py-2.5 text-wf-red font-semibold text-sm hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
                    >
                      + Add "{ex.name.trim()}" as custom exercise
                    </button>
                  </>
                )}
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
      </div>
    );
  }

  // Named exercise — render with ExerciseCard in template mode
  const cardExercise = toCardExercise(ex);
  const cardEntries = toCardEntries(ex);

  return (
    <ExerciseCard
      mode="template"
      exercise={cardExercise}
      entries={cardEntries}
      onChange={handleCardChange(exIdx)}
      onAddSet={() => addSet(exIdx)}
      onDeleteSet={(_name, setIdx) => removeSet(exIdx, setIdx)}
      onSwapExercise={handleSwapExercise(exIdx)}
      onAddExercise={handleAddExerciseBelow(exIdx)}
      onDeleteExercise={exercises.length > 1 ? () => removeExercise(exIdx) : undefined}
      onMoveUp={handleMoveUp(exIdx)}
      onMoveDown={handleMoveDown(exIdx)}
    />
  );
}
