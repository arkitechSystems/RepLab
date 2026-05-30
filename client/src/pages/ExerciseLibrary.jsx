import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExercises } from '../hooks/useExercises';
import LoadingSpinnerOverlay from '../components/LoadingSpinnerOverlay';
import { getDetailSlugs, slugify } from '../data/exercises/index.js';

// Map of exercise.name → /exercises/<slug> for hand-authored detail pages.
// Library rows whose name is in this map route to their canonical slug; rows
// outside this map route to /exercises/<slugified name> and the detail page
// builds a minimal exercise from the master library row at render time.
const DETAIL_PAGES = getDetailSlugs();

// Equipment derivation from the tags array. The master library doesn't have
// a dedicated equipment column — instead each exercise carries a tags array
// where equipment-flavored tags (barbell, dumbbell, cable, machine, etc.)
// live alongside other descriptors. Library row cards render a single
// equipment label after the muscle group; getEquipment finds the first tag
// that matches a known equipment keyword. Substring match so tag values
// like "barbell-row" or "Dumbbell Only" still resolve. Returns null when
// the exercise has no equipment tag (rare — usually bodyweight-only
// exercises that just lack the tag).
const EQUIPMENT_KEYWORDS = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'smith'];
function getEquipment(tags) {
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    const lower = String(t).toLowerCase();
    if (EQUIPMENT_KEYWORDS.some((kw) => lower.includes(kw))) return t;
  }
  return null;
}

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const { exercises, muscleGroups, loading, createCustom } = useExercises();
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customSaving, setCustomSaving] = useState(false);
  // Hide the stat strip while the search field is in focus OR carries text,
  // freeing vertical space for results. Restored when blurred AND empty.
  const [searchFocused, setSearchFocused] = useState(false);

  // Special pseudo-muscle value that filters the list to the user's custom
  // exercises only (everything else hides customs to keep the master-library
  // browse view clean). Driven by the "Custom" pill in the filter row and
  // by tapping the Custom stat-strip card.
  const CUSTOM_FILTER = 'custom';

  const filtered = useMemo(() => {
    // Default: master library only — exclude user-created custom exercises.
    // The "Custom" pill / stat card inverts this to show ONLY the user's
    // own custom exercises. Per-muscle pills also stay master-only since
    // customs don't belong to a single global muscle group in the same
    // canonical sense.
    const showOnlyCustom = selectedMuscle === CUSTOM_FILTER;
    let result = (exercises || []).filter((e) => (showOnlyCustom ? e.isCustom : !e.isCustom));
    if (selectedMuscle && !showOnlyCustom) {
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

  // ── Tactile theme tokens ──
  const LB_CARD = 'linear-gradient(180deg, #1a1816 0%, #100f0d 100%)';
  const LB_BORDER = '1px solid rgba(255,255,255,0.06)';
  const LB_HAIRLINE = '1px solid rgba(255,255,255,0.06)';
  const LB_INPUT = '1px solid rgba(255,255,255,0.08)';
  const RED = '#ef4444';
  const MONO = "'JetBrains Mono', ui-monospace, monospace"; // mono labels; falls back to system mono if not loaded

  // counts for the stat strip
  const exerciseCount = filtered.length;
  const groupCount = (muscleGroups || []).length;
  const customCount = (exercises || []).filter((e) => e.isCustom).length;

  // shared row renderer so search + grouped views stay identical. Every row
  // is tappable now: static (hand-authored) exercises route to their canonical
  // slug from DETAIL_PAGES; everything else falls back to slugify(name) and
  // ExerciseDetail's master-library fallback path builds the page from there.
  // Card layout is exercise name on top, "muscle · equipment" meta line on
  // bottom — the old tag-chip row is gone per design feedback. The showMuscle
  // arg is kept for backward call-site compat but is no longer consulted;
  // muscle group renders on every card unconditionally because the bottom
  // meta line is a single line of text per the spec.
  const renderRow = (ex, _showMuscle) => {
    const detailUrl = DETAIL_PAGES[ex.name] || `/exercises/${slugify(ex.name)}`;
    const equipment = getEquipment(ex.tags);
    const metaStyle = { fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' };
    return (
      <button
        key={ex.id}
        onClick={() => navigate(detailUrl)}
        className="active:scale-[0.98] transition-transform"
        style={{
          width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden',
          borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12,
          background: LB_CARD, border: LB_BORDER, boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }}
      >
        {ex.isCustom && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5, background: RED }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', letterSpacing: '-0.012em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
            {ex.isCustom && (
              <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', padding: '2px 6px', borderRadius: 100, background: 'rgba(239,68,68,0.14)', color: '#f5a3a3', textTransform: 'uppercase', border: '1px solid rgba(239,68,68,0.25)', flexShrink: 0 }}>Custom</span>
            )}
          </div>
          {/* Meta line: muscle group · equipment. Single line of text, no
              tag chips. Equipment falls back to nothing when the exercise
              has no equipment-flavored tag (most often bodyweight-only). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
            {ex.muscle && <span style={metaStyle}>{ex.muscle}</span>}
            {ex.muscle && equipment && <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>}
            {equipment && <span style={metaStyle}>{equipment}</span>}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 5l7 7-7 7" /></svg>
      </button>
    );
  };

  return (
    <div style={{ background: '#0c0c0b', minHeight: '100vh', color: '#fff' }} className="pb-24">
      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 0' }}>
        {/* back pill */}
        <button
          onClick={() => navigate('/utilities')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px 7px 9px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: LB_INPUT, color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 18 }}
          className="active:scale-95 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
          Utilities
        </button>

        {/* Title block + Add Custom button. "Exercise Library" sits on a
            single line with whiteSpace: 'nowrap'; the red + button anchors
            top-right and opens the inline Add Custom Exercise form. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.32em', color: RED, textTransform: 'uppercase' }}>Library</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '8px 0 0', letterSpacing: '-0.028em', lineHeight: 0.98, whiteSpace: 'nowrap' }}>Exercise Library</h1>
          </div>
          <button
            onClick={() => setShowCustomForm(!showCustomForm)}
            aria-label="Add custom exercise"
            style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(239,68,68,0.18)' }}
            className="active:scale-90 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      {/* ── Count stat strip ── Hidden while the search field is in focus
          or carries text, so the user gets more vertical real estate for
          results once they engage with search. The Custom card is a
          tappable cell that flips the muscle filter to a special CUSTOM
          value; the rest of the cells are informational. */}
      {!(searchFocused || search.trim()) && (
        <div style={{ margin: '18px 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderRadius: 16, padding: '13px 4px', background: 'rgba(255,255,255,0.03)', border: LB_BORDER }}>
            {[
              { n: exerciseCount, l: 'Exercises', onClick: null },
              { n: groupCount,    l: 'Groups',    onClick: null },
              { n: customCount,   l: 'Custom',    onClick: () => setSelectedMuscle(selectedMuscle === CUSTOM_FILTER ? '' : CUSTOM_FILTER) },
            ].map((s, i, arr) => {
              const isCustomCard = !!s.onClick;
              const selected = isCustomCard && selectedMuscle === CUSTOM_FILTER;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={s.onClick || undefined}
                  disabled={!s.onClick}
                  className={isCustomCard ? 'active:scale-[0.97] transition-transform' : ''}
                  style={{
                    background: selected ? 'rgba(239,68,68,0.10)' : 'transparent',
                    border: 'none',
                    textAlign: 'center',
                    padding: '2px 8px',
                    borderRight: i < arr.length - 1 ? LB_HAIRLINE : 'none',
                    cursor: isCustomCard ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 22, color: selected ? '#ef4444' : '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: selected ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.5)', marginTop: 5 }}>{s.l}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Custom Exercise Form ── */}
      {showCustomForm && (
        <div style={{ margin: '18px 16px 0' }} className="fade-slide-up">
          <div style={{ borderRadius: 18, padding: '18px 18px 20px', position: 'relative', overflow: 'hidden', background: LB_CARD, border: '1px solid rgba(239,68,68,0.25)', boxShadow: '0 0 0 4px rgba(239,68,68,0.05), 0 14px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.28em', color: RED, textTransform: 'uppercase' }}>New Custom Exercise</span>
              <button onClick={() => setShowCustomForm(false)} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: LB_INPUT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <label style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Exercise Name</label>
            <input
              type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Landmine Press"
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, padding: '12px 14px', marginBottom: 14, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.18)', fontSize: 14, color: '#fff', outline: 'none' }}
            />

            <label style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Muscle Group</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
              {(muscleGroups || []).map((m) => {
                const sel = customMuscle === m;
                return (
                  <button key={m} onClick={() => setCustomMuscle(m)} style={{ padding: '7px 13px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, background: sel ? '#fff' : 'rgba(255,255,255,0.05)', color: sel ? '#000' : 'rgba(255,255,255,0.7)', border: sel ? '1px solid #fff' : LB_INPUT }}>{m}</button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCustomForm(false)} style={{ flexShrink: 0, padding: '13px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: LB_INPUT, color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: 12.5 }}>Cancel</button>
              <button
                onClick={handleCreateCustom}
                disabled={!customName.trim() || !customMuscle || customSaving}
                style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: RED, color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.04em', opacity: (!customName.trim() || !customMuscle || customSaving) ? 0.5 : 1, boxShadow: '0 6px 18px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}
              >
                {customSaving ? 'Saving…' : 'Add Exercise'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div style={{ margin: '16px 16px 0', position: 'relative' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises…"
          onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 13, padding: '13px 14px 13px 40px', background: 'rgba(0,0,0,0.35)', border: LB_INPUT, color: '#fff', fontSize: 14, outline: 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* ── Muscle pills ── All, every muscle group, plus a final "Custom"
          pill that flips the list to the user's custom exercises only. The
          Custom pill mirrors the Custom stat-card tap target (both call
          setSelectedMuscle(CUSTOM_FILTER)); selecting one syncs the other. */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 16px 4px' }} className="scrollbar-none">
        {[...['All', ...(muscleGroups || [])], '__custom__'].map((g) => {
          const isCustomPill = g === '__custom__';
          const label = isCustomPill ? 'Custom' : g;
          const val = isCustomPill ? CUSTOM_FILTER : (g === 'All' ? '' : g);
          const sel = selectedMuscle === val;
          return (
            <button
              key={g}
              onClick={() => setSelectedMuscle(sel ? '' : val)}
              style={{ flexShrink: 0, padding: '8px 15px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em', background: sel ? '#fff' : 'rgba(255,255,255,0.05)', color: sel ? '#000' : 'rgba(255,255,255,0.7)', border: sel ? '1px solid #fff' : LB_INPUT, boxShadow: sel ? '0 4px 14px rgba(255,255,255,0.12)' : 'none' }}
              className="active:scale-[0.97] transition-all"
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <>
          <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="glass-skeleton" style={{ borderRadius: 14, height: 64 }} />)}
          </div>
          <LoadingSpinnerOverlay />
        </>
      )}

      {/* ── Custom filter explainer ── Shown only when the Custom pill /
          stat card is active, so the user knows they're looking at THEIR
          exercises (not in the global REPLAB library) and that the list
          comes from rows they authored themselves. */}
      {!loading && selectedMuscle === CUSTOM_FILTER && (
        <div style={{ padding: '16px 16px 0' }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
            These are exercises that you have created that aren't in the RepLab exercise library.
          </p>
        </div>
      )}

      {/* ── Search results (flat) ── */}
      {!loading && search.trim() && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 4px 12px' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>{filtered.length} Results</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((ex) => renderRow(ex, true))}
          </div>
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: '32px 0' }}>No exercises found</p>}
        </div>
      )}

      {/* ── Grouped by muscle ── */}
      {!loading && !search.trim() && grouped && (
        <div style={{ padding: '0 16px' }}>
          {Object.entries(grouped).map(([muscle, exs]) => (
            <div key={muscle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 4px 10px' }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>{muscle}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>{String(exs.length).padStart(2, '0')}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exs.map((ex) => renderRow(ex, false))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
