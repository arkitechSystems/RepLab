import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../api';
import ExerciseCard from '../components/ExerciseCard';
import RestDayCard from '../components/RestDayCard';
import StickyHeader from '../components/StickyHeader';
import PBCelebration from '../components/PBCelebration';

export default function WorkoutSession() {
  const { templateId, date } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [pbs, setPbs] = useState({});
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completedSets, setCompletedSets] = useState(new Set());
  const [newPBs, setNewPBs] = useState(null);
  const [notes, setNotes] = useState({});
  const [autoFilled, setAutoFilled] = useState(new Set()); // tracks predicted entries
  const [isCompleted, setIsCompleted] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [timerFloating, setTimerFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 16, y: 80 });
  const [showSummary, setShowSummary] = useState(false);
  const dragRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const startTimer = useCallback(() => {
    if (timerStarted) return;
    setTimerStarted(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [timerStarted]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function handleFloatTouchStart(e) {
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX - floatPos.x,
      startY: touch.clientY - floatPos.y,
      moved: false,
    };
  }

  function handleFloatTouchMove(e) {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    dragRef.current.moved = true;
    const x = Math.max(0, Math.min(window.innerWidth - 140, touch.clientX - dragRef.current.startX));
    const y = Math.max(0, Math.min(window.innerHeight - 50, touch.clientY - dragRef.current.startY));
    setFloatPos({ x, y });
  }

  function handleFloatTouchEnd() {
    dragRef.current = null;
  }

  useEffect(() => {
    Promise.all([
      api('/templates'),
      api(`/pbs?templateId=${templateId}`),
      api(`/sessions/by-template/${templateId}/${date}`),
    ])
      .then(([templates, pbList, existingSession]) => {
        const tmpl = templates.find((t) => t.id === Number(templateId));
        setTemplate(tmpl);

        const pbMap = {};
        for (const pb of pbList) {
          if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
          pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
        }
        setPbs(pbMap);

        if (tmpl && !tmpl.isRest) {
          if (existingSession && existingSession.entries) {
            // Restore saved session data
            const saved = {};
            const restoredCompleted = new Set();
            for (const ex of tmpl.exercises) {
              saved[ex.name] = ex.sets.map((s, setIdx) => {
                const match = existingSession.entries.find(
                  (e) => e.exerciseName === ex.name && e.setNumber === s.setNumber
                );
                if (match && (match.weight > 0 || match.reps > 0)) {
                  restoredCompleted.add(`${ex.name}-${setIdx}`);
                }
                return {
                  weight: match ? (match.weight || '') : (s.suggestedWeight || ''),
                  reps: match ? (match.reps || '') : '',
                };
              });
            }
            setEntries(saved);
            setCompletedSets(restoredCompleted);
            if (existingSession.notes) setNotes(existingSession.notes);
            if (existingSession.completed) setIsCompleted(true);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          } else {
            // Fresh workout from template
            const initial = {};
            for (const ex of tmpl.exercises) {
              initial[ex.name] = ex.sets.map((s) => ({
                weight: s.suggestedWeight || '',
                reps: '',
              }));
            }
            setEntries(initial);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [templateId, date]);

  function handleChange(exerciseName, setIdx, field, value) {
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      updated[exerciseName][setIdx] = {
        ...updated[exerciseName][setIdx],
        [field]: value === '' ? '' : Number(value),
      };
      return updated;
    });
    // User manually edited this field, so it's no longer auto-filled
    setAutoFilled((prev) => {
      const next = new Set(prev);
      next.delete(`${exerciseName}-${setIdx}`);
      return next;
    });
  }

  function handleAddSet(exerciseName) {
    setTemplate((prev) => {
      const updated = { ...prev, exercises: prev.exercises.map((ex) => {
        if (ex.name !== exerciseName) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSetNumber = (lastSet?.setNumber || 0) + 1;
        return {
          ...ex,
          sets: [...ex.sets, {
            setNumber: newSetNumber,
            plannedReps: lastSet?.plannedReps ?? 10,
            suggestedWeight: lastSet?.suggestedWeight ?? 0,
          }],
        };
      })};
      return updated;
    });
    setEntries((prev) => {
      const exEntries = prev[exerciseName] || [];
      const lastEntry = exEntries[exEntries.length - 1];
      return {
        ...prev,
        [exerciseName]: [...exEntries, { weight: lastEntry?.weight ?? '', reps: '' }],
      };
    });
  }

  function handleDeleteSet(exerciseName, setIdx) {
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.name !== exerciseName || ex.sets.length <= 1) return ex;
        const newSets = ex.sets.filter((_, i) => i !== setIdx)
          .map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...ex, sets: newSets };
      }),
    }));
    setEntries((prev) => {
      const exEntries = prev[exerciseName] || [];
      return {
        ...prev,
        [exerciseName]: exEntries.filter((_, i) => i !== setIdx),
      };
    });
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        const [name, idxStr] = key.split(/-(?=\d+$)/);
        const i = Number(idxStr);
        if (name !== exerciseName) {
          next.add(key);
        } else if (i < setIdx) {
          next.add(key);
        } else if (i > setIdx) {
          next.add(`${name}-${i - 1}`);
        }
      }
      return next;
    });
    setAutoFilled((prev) => {
      const next = new Set();
      for (const key of prev) {
        const [name, idxStr] = key.split(/-(?=\d+$)/);
        const i = Number(idxStr);
        if (name !== exerciseName) {
          next.add(key);
        } else if (i < setIdx) {
          next.add(key);
        } else if (i > setIdx) {
          next.add(`${name}-${i - 1}`);
        }
      }
      return next;
    });
  }

  function handleNoteChange(exerciseName, value) {
    setNotes((prev) => ({ ...prev, [exerciseName]: value }));
  }

  function handleSwapExercise(oldName, newName) {
    // Update template exercise name
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.name === oldName ? { ...ex, name: newName } : ex
      ),
    }));
    // Move entries to new name
    setEntries((prev) => {
      const updated = { ...prev };
      updated[newName] = updated[oldName] || [];
      delete updated[oldName];
      return updated;
    });
    // Move notes
    setNotes((prev) => {
      const updated = { ...prev };
      if (updated[oldName]) {
        updated[newName] = updated[oldName];
        delete updated[oldName];
      }
      return updated;
    });
    // Remap completedSets and autoFilled keys
    const remapSet = (prev) => {
      const next = new Set();
      for (const key of prev) {
        const [name, idxStr] = key.split(/-(?=\d+$)/);
        next.add(name === oldName ? `${newName}-${idxStr}` : key);
      }
      return next;
    };
    setCompletedSets(remapSet);
    setAutoFilled(remapSet);
  }

  async function handleMarkComplete() {
    const newCompleted = !isCompleted;
    try {
      await api('/sessions/complete', {
        method: 'PUT',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          completed: newCompleted,
        }),
      });
      setIsCompleted(newCompleted);
      if (newCompleted) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        navigator.vibrate?.([40, 30, 80]);
        setShowSummary(true);
      }
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  function handleToggleComplete(exerciseName, setIdx) {
    const key = `${exerciseName}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        navigator.vibrate?.(40);
        startTimer();
      }
      return next;
    });

    // When completing a set, auto-fill subsequent uncompleted sets for this exercise
    const isCompleting = !completedSets.has(key);
    if (isCompleting) {
      const exEntries = entries[exerciseName] || [];
      const thisEntry = exEntries[setIdx];
      const w = thisEntry?.weight;
      const r = thisEntry?.reps;
      if ((w !== '' && w !== undefined) || (r !== '' && r !== undefined)) {
        const exercise = template.exercises.find((e) => e.name === exerciseName);
        if (exercise) {
          setEntries((prev) => {
            const updated = { ...prev };
            updated[exerciseName] = [...(updated[exerciseName] || [])];
            const newAutoFilled = new Set(autoFilled);
            for (let i = setIdx + 1; i < exercise.sets.length; i++) {
              const laterKey = `${exerciseName}-${i}`;
              // Only auto-fill if the set isn't already completed
              if (!completedSets.has(laterKey)) {
                const current = updated[exerciseName][i] || {};
                // Only fill weight if user hasn't manually entered one
                const currentWeight = current.weight;
                const currentReps = current.reps;
                const isCurrentAutoFilled = autoFilled.has(laterKey);
                const weightEmpty = currentWeight === '' || currentWeight === undefined;
                const repsEmpty = currentReps === '' || currentReps === undefined;
                if (weightEmpty || repsEmpty || isCurrentAutoFilled) {
                  updated[exerciseName][i] = {
                    ...current,
                    weight: w !== '' && w !== undefined ? w : current.weight,
                    reps: r !== '' && r !== undefined ? r : current.reps,
                  };
                  newAutoFilled.add(laterKey);
                }
              }
            }
            setAutoFilled(newAutoFilled);
            return updated;
          });
        }
      }
    }
  }

  async function handleShare() {
    if (!template) return;

    const lines = [`${template.name} — ${format(parseISO(date), 'EEEE, MMM d')}\n`];

    for (const ex of template.exercises) {
      const exEntries = entries[ex.name] || [];
      const setLines = [];
      ex.sets.forEach((set, idx) => {
        const e = exEntries[idx];
        const w = e?.weight || 0;
        const r = e?.reps || 0;
        if (w > 0 || r > 0) {
          setLines.push(`  Set ${set.setNumber}: ${w} lbs x ${r}`);
        }
      });
      if (setLines.length > 0) {
        lines.push(ex.name);
        lines.push(...setLines);
        lines.push('');
      }
    }

    lines.push(`${completedSets.size}/${template.exercises.reduce((s, e) => s + e.sets.length, 0)} sets completed`);

    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: `${template.name} Workout`, text });
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Workout copied to clipboard!');
    }
  }

  async function handleSave() {
    if (!template || template.isRest) return;

    setSaving(true);
    try {
      // Snapshot current PBs before saving (deep copy since nested)
      const oldPbs = JSON.parse(JSON.stringify(pbs));

      const allEntries = [];
      for (const ex of template.exercises) {
        const exEntries = entries[ex.name] || [];
        ex.sets.forEach((set, idx) => {
          const key = `${ex.name}-${idx}`;
          const isAutoOnly = autoFilled.has(key) && !completedSets.has(key);
          allEntries.push({
            exerciseName: ex.name,
            setNumber: set.setNumber,
            weight: isAutoOnly ? 0 : (exEntries[idx]?.weight || 0),
            reps: isAutoOnly ? 0 : (exEntries[idx]?.reps || 0),
          });
        });
      }

      await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          entries: allEntries,
          notes,
        }),
      });

      // Refresh PBs
      const pbList = await api(`/pbs?templateId=${templateId}`);
      const pbMap = {};
      for (const pb of pbList) {
        if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
        pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
      }
      setPbs(pbMap);

      // Compare old vs new PBs to detect improvements
      const improved = [];
      for (const [exerciseName, newWeights] of Object.entries(pbMap)) {
        const oldWeights = oldPbs[exerciseName] || {};
        for (const [weight, newReps] of Object.entries(newWeights)) {
          const oldReps = oldWeights[weight];
          if (oldReps === undefined || newReps > oldReps) {
            improved.push(exerciseName);
            break;
          }
        }
      }

      if (improved.length > 0) {
        setNewPBs(improved);
        navigator.vibrate?.([40, 30, 80]);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="glass-skeleton rounded-xl h-12 w-48 mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-skeleton rounded-xl h-40 mb-3" />
        ))}
      </div>
    );
  }

  if (!template) {
    return (
      <div className="px-4 pt-6 text-center text-wf-gray-400">
        <p>Template not found</p>
      </div>
    );
  }

  const displayDate = date ? format(parseISO(date), 'EEEE, MMM d') : '';

  if (template.isRest) {
    return (
      <div>
        <div className="px-4 pt-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-2 active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>
        <StickyHeader title={template.name} subtitle={displayDate} />
        <RestDayCard />
      </div>
    );
  }

  const totalSets = template.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedCount = completedSets.size;
  const progressPct = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;

  const totalVolume = template.exercises.reduce((vol, ex) => {
    const exEntries = entries[ex.name] || [];
    return vol + exEntries.reduce((sum, e) => {
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + w * r;
    }, 0);
  }, 0);

  return (
    <div className="pb-24">
      {/* PB Celebration */}
      {newPBs && (
        <PBCelebration
          exerciseNames={newPBs}
          onDismiss={() => setNewPBs(null)}
        />
      )}

      {/* Back button */}
      <div className="px-4 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-2 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      {/* Sticky Header with Progress Bar */}
      <StickyHeader
        title={template.name}
        subtitle={`${template.description} \u2022 ${displayDate}`}
        bottomContent={
          <div className="mt-2 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-wf-gray-400 font-medium">Progress</span>
                <span className="text-xs text-wf-gray-400 font-medium tabular-nums">
                  {completedCount}/{totalSets} sets
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            {!timerFloating && (
              <>
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={() => setTimerHidden((h) => !h)}
                    className="flex-1 flex items-center"
                  >
                    <span className="text-xs text-wf-gray-400 font-medium uppercase tracking-wider">Workout Time</span>
                  </button>
                  {timerHidden ? (
                    <button onClick={() => setTimerHidden(false)} className="text-xs text-wf-gray-500">Show</button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {timerStarted && (
                        <>
                          <span className="text-base font-black text-white tabular-nums font-mono-stat">{formatTime(elapsed)}</span>
                          <button
                            onClick={() => setTimerFloating(true)}
                            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {!timerHidden && !timerStarted && (
                  <button
                    onClick={startTimer}
                    className="w-full bg-wf-red/90 hover:bg-wf-red text-white text-xs font-semibold px-4 py-2 rounded-lg active:scale-[0.98] transition-all mt-1"
                  >
                    Begin Workout
                  </button>
                )}
              </>
            )}
            {timerFloating && (
              <button
                onClick={() => setTimerFloating(false)}
                className="flex items-center gap-1.5 text-xs text-wf-gray-500"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                Dock Timer
              </button>
            )}
          </div>
        }
      />

      {/* Exercise Cards */}
      <div className="px-4">
        {template.exercises.map((exercise, idx) => (
          <div key={exercise.name} className="fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <ExerciseCard
              exercise={exercise}
              entries={entries[exercise.name]}
              pbs={pbs}
              onChange={handleChange}
              completedSets={completedSets}
              autoFilled={autoFilled}
              onToggleComplete={handleToggleComplete}
              onAddSet={handleAddSet}
              onDeleteSet={handleDeleteSet}
              onSwapExercise={handleSwapExercise}
              note={notes[exercise.name] || ''}
              onNoteChange={handleNoteChange}
            />
          </div>
        ))}
      </div>

      {/* Total Volume */}
      {totalVolume > 0 && (
        <div className="px-4 mt-4 mb-2">
          <div className="glass-card rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-wf-gray-400 font-medium">Total Volume</span>
            <span className="text-lg font-black text-white tabular-nums">
              {totalVolume.toLocaleString()} <span className="text-xs font-medium text-wf-gray-500">lbs</span>
            </span>
          </div>
        </div>
      )}

      {/* Mark Complete */}
      <div className="px-4 mb-24">
        <button
          onClick={handleMarkComplete}
          className={`w-full font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] ${
            isCompleted
              ? 'glass-card !border-wf-gray-500 text-wf-gray-400'
              : 'bg-wf-red/90 hover:bg-wf-red text-white'
          }`}
        >
          {isCompleted ? 'Undo Completion' : 'Mark Complete'}
        </button>
      </div>

      {/* Save & Share Buttons - Fixed at bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 font-semibold py-4 rounded-xl text-base transition-all active:scale-[0.98] ${
              saved
                ? 'bg-green-600 text-white shadow-[0_4px_20px_rgba(22,163,74,0.3)]'
                : 'btn-gradient text-white'
            } disabled:opacity-50`}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Session'}
          </button>
          <button
            onClick={handleShare}
            className="w-14 glass-card rounded-xl flex items-center justify-center text-wf-gray-400 hover:text-white transition-colors active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Workout Summary */}
      {showSummary && (
        <WorkoutSummary
          template={template}
          entries={entries}
          completedSets={completedSets}
          elapsed={elapsed}
          formatTime={formatTime}
          onClose={() => { setShowSummary(false); navigate('/calendar'); }}
        />
      )}

      {/* Floating Timer */}
      {timerFloating && timerStarted && (
        <div
          className="fixed z-50 touch-none"
          style={{ left: floatPos.x, top: floatPos.y }}
          onTouchStart={handleFloatTouchStart}
          onTouchMove={handleFloatTouchMove}
          onTouchEnd={handleFloatTouchEnd}
        >
          <div className="bg-wf-gray-900/95 border border-white/15 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-sm flex items-center gap-3">
            <span className="text-lg font-black text-white tabular-nums font-mono-stat">{formatTime(elapsed)}</span>
            <button
              onClick={() => setTimerFloating(false)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutSummary({ template, entries, completedSets, elapsed, formatTime, onClose }) {
  const canvasRef = useRef(null);

  // Confetti
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 2,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    let frame;
    let fadeStart = null;
    const duration = 3500;

    function animate(ts) {
      if (!fadeStart) fadeStart = ts;
      const progress = ts - fadeStart;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const globalFade = progress > duration ? Math.max(0, 1 - (progress - duration) / 1000) : 1;

      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        p.vy += 0.04;
        p.opacity = globalFade;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (globalFade > 0) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Stats
  const totalSets = template.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const totalVolume = template.exercises.reduce((vol, ex) => {
    const exEntries = entries[ex.name] || [];
    return vol + exEntries.reduce((sum, e) => {
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + w * r;
    }, 0);
  }, 0);

  // Per-exercise data with per-set breakdown
  const exerciseStats = template.exercises.map((ex) => {
    const exEntries = entries[ex.name] || [];
    const setStats = ex.sets.map((set, idx) => {
      const goal = set.plannedReps || 0;
      const actual = Number(exEntries[idx]?.reps) || 0;
      const weight = Number(exEntries[idx]?.weight) || 0;
      return { setNumber: set.setNumber, goal, actual, weight };
    });
    const totalGoal = setStats.reduce((s, ss) => s + ss.goal, 0);
    const totalActual = setStats.reduce((s, ss) => s + ss.actual, 0);
    return { name: ex.name, setStats, totalGoal, totalActual };
  });

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Content */}
      <div className="relative z-20 flex-1 overflow-y-auto safe-top safe-bottom">
        <div className="px-5 pt-4 pb-24 max-w-lg mx-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Workout Complete!</h2>
            <p className="text-wf-gray-400 text-sm">{template.name}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Time</p>
              <p className="text-lg font-black text-white tabular-nums">{formatTime(elapsed)}</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Volume</p>
              <p className="text-lg font-black text-white tabular-nums">{totalVolume.toLocaleString()}<span className="text-xs font-medium text-wf-gray-500"> lbs</span></p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Sets</p>
              <p className="text-lg font-black text-white tabular-nums">{completedSets.size}<span className="text-xs font-medium text-wf-gray-500">/{totalSets}</span></p>
            </div>
          </div>

          {/* Exercise Breakdown */}
          <div className="space-y-2">
            <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mb-1">Exercise Breakdown</p>
            {exerciseStats.map((ex) => (
              <div key={ex.name} className="glass-card rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-medium text-white truncate mr-2">{ex.name}</span>
                  <span className="text-xs text-wf-gray-400 tabular-nums shrink-0">
                    {ex.totalActual}/{ex.totalGoal} reps
                  </span>
                </div>
                <div className="space-y-1.5">
                  {ex.setStats.map((ss) => {
                    const maxRatio = 1.25;
                    const ratio = ss.goal > 0 ? ss.actual / ss.goal : 0;
                    const barPct = Math.min(100, (ratio / maxRatio) * 100);
                    const tickPos = (1 / maxRatio) * 100; // 80%
                    const barColor = ratio > 1 ? 'bg-green-500' : ratio === 1 ? 'bg-yellow-500' : 'bg-red-500';

                    return (
                      <div key={ss.setNumber} className="flex items-center gap-2">
                        <span className="text-[10px] text-wf-gray-500 w-5 shrink-0 text-right tabular-nums">{ss.setNumber}</span>
                        <div className="relative flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${barColor}`}
                            style={{ width: `${barPct}%` }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                            style={{ left: `${tickPos}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-wf-gray-400 w-14 shrink-0 text-right tabular-nums">
                          {ss.actual}/{ss.goal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Done button */}
      <div className="relative z-20 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom">
        <button
          onClick={onClose}
          className="w-full btn-gradient text-white font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}
