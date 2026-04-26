import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExercises } from '../hooks/useExercises';
import LoadingSpinnerOverlay from '../components/LoadingSpinnerOverlay';
import { getDetailSlugs } from '../data/exercises/index.js';

// Auto-generated from registered exercise detail pages
const DETAIL_PAGES = getDetailSlugs();

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

  const NIKE_PANEL = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors mb-5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {/* Nike intro panel */}
      <div className="relative overflow-hidden mb-4 fade-slide-up" style={{ ...NIKE_PANEL, boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #3b82f6, rgba(59,130,246,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(59,130,246,0.85)', letterSpacing: '0.4em' }}>
                Library
              </p>
              <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                EXERCISE LIBRARY
              </h1>
              <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
                {filtered.length} exercises · tap to view details, or add your own.
              </p>
            </div>
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              aria-label="Add custom exercise"
              className="w-10 h-10 flex items-center justify-center text-wf-red active:scale-90 transition-all shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.10) 100%)',
                borderRadius: '2px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(239,68,68,0.20)',
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Exercise Form */}
      {showCustomForm && (
        <div className="p-5 mb-4 fade-slide-up" style={{ ...NIKE_PANEL, borderLeft: '3px solid #ef4444' }}>
          <p className="text-[10px] uppercase font-bold mb-3" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
            New Custom Exercise
          </p>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Exercise name"
            className="w-full glass-input rounded-[2px] px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none mb-2"
          />
          <select
            value={customMuscle}
            onChange={(e) => setCustomMuscle(e.target.value)}
            className="w-full glass-input rounded-[2px] px-3 py-2.5 text-white text-sm bg-transparent focus:outline-none appearance-none cursor-pointer mb-3"
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
              className="flex-1 text-[11px] uppercase font-bold tracking-wider py-3 active:scale-[0.98] transition-transform"
              style={{
                letterSpacing: '0.2em',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCustom}
              disabled={!customName.trim() || !customMuscle || customSaving}
              className={`flex-1 text-white text-[11px] font-bold uppercase tracking-wider py-3 active:scale-[0.98] transition-transform disabled:opacity-50 ${customSaving ? 'btn-liquid' : ''}`}
              style={customSaving ? {
                letterSpacing: '0.2em',
                borderRadius: '2px',
              } : {
                letterSpacing: '0.2em',
                borderRadius: '2px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {customSaving ? 'Saving…' : 'Add Exercise'}
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
          className="w-full glass-input rounded-[2px] pl-10 pr-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none"
        />
      </div>

      {/* Muscle Group Filter — Nike pill row: white-bg/black-text inactive,
          black-bg/white-text active. */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none mb-3">
        <button
          onClick={() => setSelectedMuscle('')}
          className="shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.97]"
          style={!selectedMuscle
            ? { background: '#000000', color: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }
            : { background: '#ffffff', color: '#000000', boxShadow: '0 4px 12px rgba(255,255,255,0.10)' }
          }
        >
          All
        </button>
        {(muscleGroups || []).map(m => (
          <button
            key={m}
            onClick={() => setSelectedMuscle(selectedMuscle === m ? '' : m)}
            className="shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.97]"
            style={selectedMuscle === m
              ? { background: '#000000', color: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }
              : { background: '#ffffff', color: '#000000', boxShadow: '0 4px 12px rgba(255,255,255,0.10)' }
            }
          >
            {m}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-14" />
            ))}
          </div>
          <LoadingSpinnerOverlay />
        </>
      )}

      {/* Exercise List */}
      {!loading && search.trim() && (
        <div className="space-y-1.5">
          {filtered.map(ex => {
            const detailUrl = DETAIL_PAGES[ex.name];
            const Row = detailUrl ? 'button' : 'div';
            return (
              <Row
                key={ex.id}
                {...(detailUrl ? { onClick: () => navigate(detailUrl) } : {})}
                className={`w-full px-4 py-3 flex items-center justify-between text-left ${detailUrl ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''}`}
                style={{ ...NIKE_PANEL, borderLeft: ex.isCustom ? '3px solid #ef4444' : '3px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-bold uppercase text-white truncate" style={{ letterSpacing: '0.06em' }}>{ex.name}</span>
                  {ex.isCustom && (
                    <span className="text-[8px] uppercase font-bold shrink-0" style={{
                      background: 'rgba(239,68,68,0.18)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: '2px',
                      padding: '1px 5px',
                      letterSpacing: '0.2em',
                    }}>Custom</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-white/35 uppercase font-bold" style={{ letterSpacing: '0.18em' }}>{ex.muscle}</span>
                  {detailUrl && (
                    <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <div key={muscle} className="mb-5">
              <p className="text-[10px] uppercase font-bold mb-2 px-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
                {muscle}
              </p>
              <div className="space-y-1.5">
                {exs.map(ex => {
                  const detailUrl = DETAIL_PAGES[ex.name];
                  const Row = detailUrl ? 'button' : 'div';
                  return (
                    <Row
                      key={ex.id}
                      {...(detailUrl ? { onClick: () => navigate(detailUrl) } : {})}
                      className={`w-full px-4 py-3 flex items-center justify-between text-left ${detailUrl ? 'active:scale-[0.98] transition-transform cursor-pointer' : ''}`}
                      style={{ ...NIKE_PANEL, borderLeft: ex.isCustom ? '3px solid #ef4444' : '3px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-bold uppercase text-white truncate" style={{ letterSpacing: '0.06em' }}>{ex.name}</span>
                        {ex.isCustom && (
                          <span className="text-[8px] uppercase font-bold shrink-0" style={{
                            background: 'rgba(239,68,68,0.18)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239,68,68,0.4)',
                            borderRadius: '2px',
                            padding: '1px 5px',
                            letterSpacing: '0.2em',
                          }}>Custom</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex gap-1 flex-wrap justify-end">
                          {ex.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[8px] uppercase font-bold tracking-wider"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '2px',
                                padding: '1px 5px',
                                color: 'rgba(255,255,255,0.4)',
                                letterSpacing: '0.15em',
                              }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                        {detailUrl && (
                          <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
