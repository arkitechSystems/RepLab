import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CreateProgram() {
  const navigate = useNavigate();
  const [programName, setProgramName] = useState('');
  const [workouts, setWorkouts] = useState([
    { name: '', description: '', isRest: false },
  ]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedule, setSchedule] = useState([null, null, null, null, null, null, null]); // Sun-Sat, index into workouts
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addWorkout() {
    setWorkouts([...workouts, { name: '', description: '', isRest: false }]);
  }

  function removeWorkout(idx) {
    const updated = workouts.filter((_, i) => i !== idx);
    setWorkouts(updated);
    // Fix schedule references
    setSchedule(schedule.map((s) => {
      if (s === null) return null;
      if (s === idx) return null;
      if (s > idx) return s - 1;
      return s;
    }));
  }

  function updateWorkout(idx, field, value) {
    const updated = [...workouts];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'isRest' && value) {
      updated[idx].name = 'Rest';
      updated[idx].description = 'Recovery Day';
    }
    setWorkouts(updated);
  }

  function assignDay(dayIdx, workoutIdx) {
    const updated = [...schedule];
    updated[dayIdx] = workoutIdx === '' ? null : Number(workoutIdx);
    setSchedule(updated);
  }

  async function handleSave() {
    setError('');

    if (!programName.trim()) {
      setError('Program name is required');
      return;
    }

    const validWorkouts = workouts.filter((w) => w.name.trim() || w.isRest);
    if (validWorkouts.length === 0) {
      setError('Add at least one workout');
      return;
    }

    for (const w of validWorkouts) {
      if (!w.isRest && !w.name.trim()) {
        setError('All workouts need a name');
        return;
      }
    }

    setSaving(true);
    try {
      // Create the program first
      const program = await api('/programs', {
        method: 'POST',
        body: JSON.stringify({ name: programName.trim() }),
      });

      // Create all templates linked to this program
      const createdTemplates = [];
      for (const w of validWorkouts) {
        const result = await api('/templates', {
          method: 'POST',
          body: JSON.stringify({
            name: w.name.trim(),
            description: w.description.trim(),
            exercises: [],
            programId: program.id,
            isRest: w.isRest,
          }),
        });
        createdTemplates.push(result);
      }

      // Set up schedule if enabled
      if (scheduleEnabled) {
        const scheduleEntries = [];
        for (let day = 0; day < 7; day++) {
          const workoutIdx = schedule[day];
          if (workoutIdx !== null && workoutIdx < validWorkouts.length) {
            if (createdTemplates[workoutIdx]) {
              scheduleEntries.push({
                dayOfWeek: day,
                templateId: createdTemplates[workoutIdx].id,
              });
            }
          }
        }

        if (scheduleEntries.length > 0) {
          await api('/schedule', {
            method: 'PUT',
            body: JSON.stringify({ schedule: scheduleEntries }),
          });
        }
      }

      navigate('/workouts');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-3xl font-black text-white tracking-tight mb-2">New Program</h1>
      <p className="text-sm text-wf-gray-400 mb-6">
        Define your workouts, then add exercises to each one later.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Program Name */}
      <div className="mb-6">
        <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Program Name</label>
        <input
          type="text"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="e.g. Push, Pull, Legs"
          className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
        />
      </div>

      {/* Workouts */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Workouts</h2>

        {workouts.map((w, idx) => (
          <div key={idx} className="glass-card rounded-xl p-4 mb-3 fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-wf-gray-500 uppercase tracking-wider font-medium">
                Workout {idx + 1}
              </span>
              <div className="flex items-center gap-3">
                {/* Rest day toggle */}
                <button
                  type="button"
                  onClick={() => updateWorkout(idx, 'isRest', !w.isRest)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                    w.isRest
                      ? 'bg-wf-purple/30 text-wf-purple border border-wf-purple/40'
                      : 'bg-white/5 text-wf-gray-400 border border-white/10'
                  }`}
                >
                  {w.isRest ? 'Rest Day' : 'Rest?'}
                </button>
                {workouts.length > 1 && (
                  <button
                    onClick={() => removeWorkout(idx)}
                    className="text-wf-gray-500 active:text-red-500 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {w.isRest ? (
              <div className="flex items-center gap-2 text-wf-purple">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
                <span className="text-sm font-medium">Recovery Day</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={w.name}
                  onChange={(e) => updateWorkout(idx, 'name', e.target.value)}
                  placeholder="Workout name (e.g. Push)"
                  className="w-full glass-input rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all mb-2"
                />
                <input
                  type="text"
                  value={w.description}
                  onChange={(e) => updateWorkout(idx, 'description', e.target.value)}
                  placeholder="Description (e.g. Chest, Shoulders, Triceps)"
                  className="w-full glass-input rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                />
              </>
            )}
          </div>
        ))}

        <button
          onClick={addWorkout}
          className="w-full border border-dashed border-white/15 rounded-xl py-3 text-wf-gray-400 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors"
        >
          + Add Workout
        </button>
      </div>

      {/* Schedule Setup */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setScheduleEnabled(!scheduleEnabled)}
          className="flex items-center gap-3 mb-3"
        >
          <div className={`w-11 h-6 rounded-full transition-all duration-200 relative ${
            scheduleEnabled ? 'bg-wf-red' : 'bg-white/20'
          }`}>
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
              scheduleEnabled ? 'left-[22px]' : 'left-0.5'
            }`} />
          </div>
          <span className="text-base font-semibold text-white">Set Weekly Schedule</span>
        </button>

        {scheduleEnabled && (
          <div className="glass-card rounded-xl p-4 space-y-2.5">
            {DAY_NAMES.map((dayName, dayIdx) => {
              const validWorkouts = workouts.filter((w) => w.name.trim() || w.isRest);
              return (
                <div key={dayIdx} className="flex items-center gap-3">
                  <span className="text-sm text-wf-gray-400 font-medium w-10">{dayName}</span>
                  <select
                    value={schedule[dayIdx] ?? ''}
                    onChange={(e) => assignDay(dayIdx, e.target.value)}
                    className="flex-1 glass-input rounded-lg px-3 py-2 text-white text-sm bg-transparent focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-wf-gray-900">— None —</option>
                    {workouts.map((w, wIdx) => (
                      <option key={wIdx} value={wIdx} className="bg-wf-gray-900">
                        {w.isRest ? 'Rest' : w.name || `Workout ${wIdx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-4 rounded-xl text-base transition-all disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Program'}
        </button>
      </div>
    </div>
  );
}
