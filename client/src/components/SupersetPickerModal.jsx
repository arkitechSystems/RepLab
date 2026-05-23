import { useEffect, useState } from 'react';
import WheelPicker from './WheelPicker.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

// Two-wheel picker that builds a superset/circuit label like "A1", "B3", etc.
// Opened by long-pressing an exercise name in a workout card. Letters A-G and
// numbers 1-7 cover the common training notation (Crossfit-style "AMRAP A/B/C"
// or paired-set "A1/A2") without overwhelming the UI with rarely-used slots.
//
// Behavior
//   • initialLabel: if non-empty, parsed into letter+number and the wheels open
//     at those positions. If empty, both wheels open at A/1 visually (parsed as
//     "no selection yet" — Set still returns "A1").
//   • onConfirm(label): user tapped Set. Always a 2-char string.
//   • onClear():        user tapped Clear under the wheels. Parent should wipe
//                       the stored label but leave any per-set setType
//                       overrides alone (the user might want to keep them).
//   • onClose():        Cancel button OR backdrop tap. Discards changes.
//
// Style follows the rest of the dark Nike-ish modal idiom (PlateCalculatorModal,
// section-edit modal): 160deg gradient panel, 2px corners, red top accent bar,
// ambient red spotlight.
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7'];

function parseLabel(label) {
  if (!label || typeof label !== 'string') return { letter: 'A', number: '1' };
  const letter = LETTERS.includes(label[0]) ? label[0] : 'A';
  const number = NUMBERS.includes(label[1]) ? label[1] : '1';
  return { letter, number };
}

export default function SupersetPickerModal({ open, initialLabel = '', onConfirm, onClear, onClose }) {
  const trapRef = useFocusTrap(open);
  const [letter, setLetter] = useState('A');
  const [number, setNumber] = useState('1');

  // Reset wheel positions every time the modal opens. Without this, picking
  // B2 → closing → re-opening on a card with no label would still show B2.
  useEffect(() => {
    if (!open) return;
    const parsed = parseLabel(initialLabel);
    setLetter(parsed.letter);
    setNumber(parsed.number);
  }, [open, initialLabel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="superset-picker-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={trapRef}
        className="relative w-full max-w-sm overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        {/* Close X */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 text-wf-gray-400 active:opacity-70"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative px-5 pt-5 pb-3">
          <p className="text-[10px] text-white/30 uppercase font-light" style={{ letterSpacing: '0.3em' }}>
            Group Exercises
          </p>
          <h2
            id="superset-picker-title"
            className="text-[22px] font-black text-white tracking-tight mt-1 uppercase"
            style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}
          >
            Superset Label
          </h2>
          <p className="text-[11px] text-white/40 font-light mt-2 leading-relaxed">
            Pair this exercise with others by giving them the same letter. The number sets the order within the pair.
          </p>
        </div>

        {/* Wheels — letter + number side by side, with a "·" separator that
            matches how the label renders inline on the exercise name. */}
        <div className="relative px-5 pb-4">
          <div
            className="flex items-stretch justify-center gap-3"
            style={{
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '2px',
              padding: '8px 4px',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ flex: 1 }}>
              <WheelPicker
                items={LETTERS}
                value={letter}
                onChange={setLetter}
                ariaLabel="Superset letter"
              />
            </div>
            <div
              aria-hidden="true"
              className="flex items-center justify-center text-white/30 font-black"
              style={{ fontFamily: 'system-ui', fontSize: 28, lineHeight: 1, width: 8 }}
            >
              ·
            </div>
            <div style={{ flex: 1 }}>
              <WheelPicker
                items={NUMBERS}
                value={number}
                onChange={setNumber}
                ariaLabel="Superset number"
              />
            </div>
          </div>

          {/* Clear button — lives BELOW the wheels so neither wheel has a "—"
              slot the user could accidentally pick. */}
          <button
            type="button"
            onClick={() => { onClear?.(); onClose?.(); }}
            className="w-full mt-3 font-bold uppercase active:scale-[0.98] transition-all border border-white/15"
            style={{
              letterSpacing: '0.15em',
              fontSize: '10px',
              padding: '10px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            Clear Label
          </button>
        </div>

        {/* Footer — Set + Cancel */}
        <div className="relative px-4 pb-4 pt-2 space-y-2 shrink-0 border-t border-white/5">
          <button
            onClick={() => { onConfirm?.(`${letter}${number}`); onClose?.(); }}
            className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all"
            style={{
              letterSpacing: '0.15em',
              fontSize: '11px',
              padding: '14px',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            Set {letter}{number}
          </button>
          <button
            onClick={onClose}
            className="w-full font-bold uppercase active:scale-[0.98] transition-all border border-white/15"
            style={{
              letterSpacing: '0.15em',
              fontSize: '11px',
              padding: '14px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
