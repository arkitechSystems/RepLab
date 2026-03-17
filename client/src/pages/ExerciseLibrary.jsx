import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExercises } from '../hooks/useExercises';

// Exercises with detail pages (slug → true)
const DETAIL_PAGES = {
  'Incline Bench Press': '/exercises/incline-bench-press',
};

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const { exercises, muscleGroups, loading, createCustom } = useExercises();
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customSaving, setCustomSaving] = useState(false);

  const filtered = useMemo(() => {
    let result = exercises || [];
    if (selectedMuscle) {
      result = result.filter(e => e.muscle === selectedMuscle);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(q));
    }
    // Deduplicate by name
    const seen = new Set();
    return result.filter(e => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });
  }, [exercises, search, selectedMuscle]);

  // Group by muscle for display when not searching
  const grouped = useMemo(() => {
    if (search.trim()) return null;
    const groups = {};
    for (const ex of filtered) {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    }
    return groups;
  }, [filtered, search]);

  async function handleCreateCustom() {
    if (!customName.trim() || !customMuscle) return;
    setCustomSaving(true);
    try {
      await createCustom(customName.trim(), customMuscle);
      setCustomName('');
      setCustomMuscle('');
      setShowCustomForm(false);
    } catch (err) {
      alert('Failed to create exercise: ' + err.message);
    } finally {
      setCustomSaving(false);
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

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl font-black text-white tracking-tight">Exercise Library</h1>
        <button
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="w-9 h-9 rounded-full bg-wf-red/20 flex items-center justify-center text-wf-red active:scale-90 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-wf-gray-400 mb-4">{filtered.length} exercises</p>

      {/* Custom Exercise Form */}
      {showCustomForm && (
        <div className="glass-card rounded-xl p-4 mb-4 border border-wf-red/20">
          <h3 className="text-sm font-semibold text-white mb-3">Add Custom Exercise</h3>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Exercise name"
            className="w-full glass-input rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none mb-2"
          />
          <select
            value={customMuscle}
            onChange={(e) => setCustomMuscle(e.target.value)}
            className="w-full glass-input rounded-lg px-3 py-2.5 text-white text-sm bg-transparent focus:outline-none appearance-none cursor-pointer mb-3"
          >
            <option value="" className="bg-wf-gray-900">Select muscle group</option>
            {(muscleGroups || []).map(m => (
              <option key={m} value={m} className="bg-wf-gray-900">{m}</option>
            ))}
            <option value="Other" className="bg-wf-gray-900">Other</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomForm(false)}
              className="flex-1 glass-card text-white font-medium py-2.5 rounded-xl text-sm active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCustom}
              disabled={!customName.trim() || !customMuscle || customSaving}
              className="flex-1 btn-gradient text-white font-medium py-2.5 rounded-xl text-sm active:scale-[0.98] disabled:opacity-50"
            >
              {customSaving ? 'Saving...' : 'Add Exercise'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none"
        />
      </div>

      {/* Muscle Group Filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none mb-2">
        <button
          onClick={() => setSelectedMuscle('')}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
            !selectedMuscle ? 'bg-wf-red text-white' : 'bg-white/5 text-wf-gray-400 border border-white/10'
          }`}
        >
          All
        </button>
        {(muscleGroups || []).map(m => (
          <button
            key={m}
            onClick={() => setSelectedMuscle(selectedMuscle === m ? '' : m)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              selectedMuscle === m ? 'bg-wf-red text-white' : 'bg-white/5 text-wf-gray-400 border border-white/10'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-skeleton rounded-xl h-14" />
          ))}
        </div>
      )}

      {/* Exercise List */}
      {!loading && search.trim() && (
        <div className="space-y-1">
          {filtered.map(ex => {
            const detailUrl = DETAIL_PAGES[ex.name];
            const Row = detailUrl ? 'button' : 'div';
            return (
              <Row
                key={ex.id}
                {...(detailUrl ? { onClick: () => navigate(detailUrl) } : {})}
                className={`w-full glass-card rounded-xl px-4 py-3 flex items-center justify-between text-left ${detailUrl ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''}`}
              >
                <div>
                  <span className="text-sm font-medium text-white">{ex.name}</span>
                  {ex.isCustom && (
                    <span className="ml-2 text-[10px] text-wf-red uppercase tracking-wider font-semibold">Custom</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider">{ex.muscle}</span>
                  {detailUrl && (
                    <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              </Row>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-wf-gray-500 text-sm py-8">No exercises found</p>
          )}
        </div>
      )}

      {/* Grouped by muscle */}
      {!loading && !search.trim() && grouped && (
        <div>
          {Object.entries(grouped).map(([muscle, exs]) => (
            <div key={muscle} className="mb-4">
              <h3 className="text-xs text-wf-gray-500 uppercase tracking-widest font-medium mb-2">{muscle}</h3>
              <div className="space-y-1">
                {exs.map(ex => {
                  const detailUrl = DETAIL_PAGES[ex.name];
                  const Row = detailUrl ? 'button' : 'div';
                  return (
                    <Row
                      key={ex.id}
                      {...(detailUrl ? { onClick: () => navigate(detailUrl) } : {})}
                      className={`w-full glass-card rounded-xl px-4 py-3 flex items-center justify-between text-left ${detailUrl ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''}`}
                    >
                      <div>
                        <span className="text-sm font-medium text-white">{ex.name}</span>
                        {ex.isCustom && (
                          <span className="ml-2 text-[10px] text-wf-red uppercase tracking-wider font-semibold">Custom</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 flex-wrap justify-end">
                          {ex.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] text-wf-gray-600 bg-white/5 rounded-full px-2 py-0.5">{tag}</span>
                          ))}
                        </div>
                        {detailUrl && (
                          <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        )}
                      </div>
                    </Row>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
