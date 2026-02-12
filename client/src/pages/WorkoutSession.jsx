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

  useEffect(() => {
    Promise.all([
      api('/templates'),
      api(`/pbs?templateId=${templateId}`),
    ])
      .then(([templates, pbList]) => {
        const tmpl = templates.find((t) => t.id === Number(templateId));
        setTemplate(tmpl);

        const pbMap = {};
        for (const pb of pbList) {
          pbMap[pb.exerciseName] = pb;
        }
        setPbs(pbMap);

        if (tmpl && !tmpl.isRest) {
          const initial = {};
          for (const ex of tmpl.exercises) {
            initial[ex.name] = ex.sets.map((s) => ({
              weight: s.suggestedWeight,
              reps: '',
            }));
          }
          setEntries(initial);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [templateId]);

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

  function handleToggleComplete(exerciseName, setIdx) {
    const key = `${exerciseName}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!template || template.isRest) return;

    setSaving(true);
    try {
      // Snapshot current PBs before saving
      const oldPbs = { ...pbs };

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
        }),
      });

      // Refresh PBs
      const pbList = await api(`/pbs?templateId=${templateId}`);
      const pbMap = {};
      for (const pb of pbList) {
        pbMap[pb.exerciseName] = pb;
      }
      setPbs(pbMap);

      // Compare old vs new PBs to detect improvements
      const improved = [];
      if (Object.keys(oldPbs).length > 0) {
        for (const [exerciseName, newPb] of Object.entries(pbMap)) {
          const oldPb = oldPbs[exerciseName];
          if (!oldPb) {
            improved.push(exerciseName);
          } else if (
            newPb.bestWeight > oldPb.bestWeight ||
            (newPb.bestWeight === oldPb.bestWeight && newPb.bestReps > oldPb.bestReps)
          ) {
            improved.push(exerciseName);
          }
        }
      }

      if (improved.length > 0) {
        setNewPBs(improved);
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

      {/* Sticky Header */}
      <StickyHeader
        title={template.name}
        subtitle={`${template.description} \u2022 ${displayDate}`}
      />

      {/* Progress Bar */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-1.5">
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
            />
          </div>
        ))}
      </div>

      {/* Save Button - Fixed at bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full font-semibold py-4 rounded-xl text-base transition-all active:scale-[0.98] ${
            saved
              ? 'bg-green-600 text-white shadow-[0_4px_20px_rgba(22,163,74,0.3)]'
              : 'btn-gradient text-white'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Session'}
        </button>
      </div>
    </div>
  );
}
