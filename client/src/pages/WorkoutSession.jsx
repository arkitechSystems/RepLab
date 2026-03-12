import { useState, useEffect } from 'react';
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
  const [isCompleted, setIsCompleted] = useState(false);

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
  }

  function handleNoteChange(exerciseName, value) {
    setNotes((prev) => ({ ...prev, [exerciseName]: value }));
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
        navigator.vibrate?.([40, 30, 80]);
        navigate('/');
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
      }
      return next;
    });
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
          allEntries.push({
            exerciseName: ex.name,
            setNumber: set.setNumber,
            weight: exEntries[idx]?.weight || 0,
            reps: exEntries[idx]?.reps || 0,
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
          <div className="mt-2">
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
              onToggleComplete={handleToggleComplete}
              onAddSet={handleAddSet}
              onDeleteSet={handleDeleteSet}
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
    </div>
  );
}
