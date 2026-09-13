import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

const RED = '#ef4444';
const CARD = 'linear-gradient(180deg, #1a1816 0%, #100f0d 100%)';
const BORDER = '1px solid rgba(255,255,255,0.06)';
const INPUT = '1px solid rgba(255,255,255,0.08)';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// One card per equipment item. `items` is an array so a card can later map
// to several equipment keys without touching the filter logic.
const EQUIPMENT = [
  { id: 'pullup',   title: 'Pull-up bar', sub: 'Doorway or mounted bar',        items: ['pullup'] },
  { id: 'band',     title: 'Bands',       sub: 'Loop or tube resistance bands', items: ['band'] },
  { id: 'dumbbell', title: 'Dumbbells',   sub: 'Any adjustable or fixed pair',  items: ['dumbbell'] },
];

const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core'];

// Replace with a real fetch from the exercise library, filtered to at-home
// movements. Shape: { equip, part } drive the two filters.
const EXERCISES = [
  { name: 'Band Chest Press',    muscles: 'Chest · Shoulders',  sets: 3, reps: 12,     level: 1, equip: 'band',     part: 'Chest',     cue: 'Anchor behind you at chest height, press and pause.' },
  { name: 'Band Push-Up',        muscles: 'Chest · Triceps',    sets: 3, reps: '8–12', level: 2, equip: 'band',     part: 'Chest',     cue: 'Band across the back — adds tension at the top.' },
  { name: 'Band Overhead Press', muscles: 'Shoulders',          sets: 3, reps: 12,     level: 1, equip: 'band',     part: 'Shoulders', cue: 'Stand on the band, press straight up past the ears.' },
  { name: 'Band Lateral Raise',  muscles: 'Side Delts',         sets: 3, reps: 15,     level: 1, equip: 'band',     part: 'Shoulders', cue: 'Lead with the elbows, stop at shoulder height.' },
  { name: 'Band Front Raise',    muscles: 'Front Delts',        sets: 2, reps: 15,     level: 1, equip: 'band',     part: 'Shoulders', cue: 'Straight arms up to eye level, slow on the way down.' },
  { name: 'Pull-Up',             muscles: 'Back · Biceps',      sets: 3, reps: '5–8',  level: 3, equip: 'pullup',   part: 'Back',      cue: 'Chest to the bar, control the way down.' },
  { name: 'Dumbbell Floor Press',muscles: 'Chest · Triceps',    sets: 3, reps: 10,     level: 2, equip: 'dumbbell', part: 'Chest',     cue: 'Let the triceps touch down, then drive back up.' },
  { name: 'Goblet Squat',        muscles: 'Quads · Glutes',     sets: 3, reps: 10,     level: 2, equip: 'dumbbell', part: 'Legs',      cue: 'Chest tall, knees track the toes, sit between the hips.' },
];

// Equipment glyphs — stroked line icons in the app ink.
function EquipIcon({ kind, size = 15, color = 'rgba(255,255,255,0.75)' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'band')     return <svg {...p}><path d="M4 6c6 0 6 12 12 12" /><path d="M3.2 4.6a1.6 1.6 0 100 2.8M20.8 16.6a1.6 1.6 0 100 2.8" /></svg>;
  if (kind === 'dumbbell') return <svg {...p}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></svg>;
  if (kind === 'pullup')   return <svg {...p}><path d="M3 5h18M8 5v3M16 5v3" /><circle cx="12" cy="12.5" r="2" /><path d="M12 14.5v4M10 20l2-1.5 2 1.5" /></svg>;
  return null;
}

function Dots({ level = 1 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3].map(n => (
        <span key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: n <= level ? RED : 'rgba(255,255,255,0.18)' }} />
      ))}
    </span>
  );
}

// Mono section header + hairline rule, optional right-aligned meta.
function Section({ label, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 16px 12px' }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      {right && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', flexShrink: 0 }}>{right}</span>}
    </div>
  );
}

// Equipment card — icon square, title/sub, radio check on the right.
function EquipCard({ item, selected, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left active:scale-[0.98] transition-transform"
      style={{
        borderRadius: 16, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 13,
        background: CARD,
        border: selected ? '1px solid rgba(239,68,68,0.4)' : BORDER,
        boxShadow: selected ? '0 0 0 3px rgba(239,68,68,0.08), 0 8px 20px rgba(0,0,0,0.4)' : '0 6px 16px rgba(0,0,0,0.3)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
        background: selected ? 'linear-gradient(135deg, rgba(239,68,68,0.26), rgba(239,68,68,0.09))' : 'rgba(255,255,255,0.04)',
        border: selected ? '1px solid rgba(239,68,68,0.38)' : INPUT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <EquipIcon kind={item.items[0]} size={19} color={selected ? RED : 'rgba(255,255,255,0.7)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', letterSpacing: '-0.012em' }}>{item.title}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{item.sub}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: selected ? RED : 'transparent',
        border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </div>
    </button>
  );
}

// Exercise row — demo thumb w/ play, name, equip glyph, difficulty dots,
// muscles · sets × reps, one-line form cue.
function ExerciseRow({ e }) {
  return (
    <div style={{ borderRadius: 16, padding: '11px 12px', background: CARD, border: BORDER, boxShadow: '0 6px 16px rgba(0,0,0,0.3)', display: 'flex', gap: 11 }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'repeating-linear-gradient(135deg, #1e1c1a 0 10px, #191715 10px 20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3" /></svg>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.012em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
          <EquipIcon kind={e.equip} size={13} color="rgba(255,255,255,0.45)" />
          <Dots level={e.level} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.42)', marginTop: 4, textTransform: 'uppercase' }}>
          {e.muscles} · {e.sets} × {e.reps}
        </div>
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', margin: '6px 0 0', lineHeight: 1.4 }}>{e.cue}</p>
      </div>
    </div>
  );
}

export default function PreGymProgram() {
  const navigate = useNavigate();
  const [equip, setEquip] = useState(['band']);          // selected equipment card ids
  const [parts, setParts] = useState(['Chest', 'Shoulders']); // selected body parts

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  // Both filters drive the list. Empty selections mean "no constraint" so the
  // page never shows an empty state on first load.
  const matches = useMemo(() => {
    const keys = EQUIPMENT.filter(x => equip.includes(x.id)).flatMap(x => x.items);
    return EXERCISES.filter(e =>
      (keys.length === 0 || keys.includes(e.equip)) &&
      (parts.length === 0 || parts.includes(e.part))
    );
  }, [equip, parts]);

  return (
    <div style={{ background: '#0c0c0b', minHeight: '100vh', color: '#fff' }}>
      <StickyHeader title="PRE-GYM" titleStyle={{ fontSize: '26.4px' }} />

      <div className="pb-32">
        {/* Editorial header */}
        <div style={{ padding: '8px 20px 0' }} className="fade-slide-up">
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.32em', color: RED, textTransform: 'uppercase' }}>Step 1 of 2</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: '8px 0 0', letterSpacing: '-0.03em', lineHeight: 1.0 }}>
            What have you<br />got at home?
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.55)', margin: '12px 0 0', maxWidth: 320 }}>
            Pick your equipment and the body parts you want to train — the exercises below filter to match.
          </p>
        </div>

        {/* 1 — Equipment */}
        <Section label="Equipment" right={`${equip.length} selected`} />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EQUIPMENT.map(item => (
            <EquipCard key={item.id} item={item} selected={equip.includes(item.id)} onToggle={() => toggle(equip, setEquip, item.id)} />
          ))}
        </div>

        {/* 2 — Body parts */}
        <Section label="Body Parts" right={`${parts.length} selected`} />
        <div style={{ paddingLeft: 16, display: 'flex', gap: 7, overflowX: 'auto' }} className="scrollbar-hide">
          {BODY_PARTS.map(p => {
            const on = parts.includes(p);
            return (
              <button
                key={p}
                onClick={() => toggle(parts, setParts, p)}
                style={{
                  flex: '0 0 auto', padding: '8px 14px', borderRadius: 100,
                  background: on ? RED : 'rgba(255,255,255,0.04)',
                  border: on ? 'none' : INPUT,
                  color: on ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {p}
              </button>
            );
          })}
          <div style={{ flex: '0 0 16px' }} />
        </div>

        {/* 3 — Live-filtered exercises */}
        <Section label="Exercises" right={`${matches.length} match${matches.length === 1 ? '' : 'es'}`} />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', padding: '4px 2px' }}>
              No exercises match those filters yet — try another body part or add equipment.
            </p>
          ) : (
            matches.map(e => <ExerciseRow key={e.name} e={e} />)
          )}
        </div>
      </div>

      {/* Sticky dock — tally + continue. bottom: 88 clears the app's bottom
          tab bar — /pre-gym renders inside the Layout+BottomNav route group. */}
      <div style={{
        position: 'fixed', left: 16, right: 16, bottom: 88, zIndex: 40,
        display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderRadius: 16,
        background: 'rgba(20,18,16,0.94)', backdropFilter: 'blur(20px)',
        border: BORDER, boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', flex: 1, paddingLeft: 8 }}>
          {matches.length} exercises
        </span>
        <button
          disabled={matches.length === 0}
          style={{
            flexShrink: 0, padding: '13px 22px', borderRadius: 12, border: 'none',
            background: RED, color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.03em',
            cursor: matches.length === 0 ? 'default' : 'pointer',
            opacity: matches.length === 0 ? 0.5 : 1,
            boxShadow: '0 6px 18px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.16)',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
