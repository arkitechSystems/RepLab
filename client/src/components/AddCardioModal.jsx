import { useState, useEffect } from 'react';

// Two-step modal for logging a cardio entry inside a workout session.
// Step 1: pick a machine (7 options, tile grid).
// Step 2: tailored field form per machine + collapsible "More" for
//         calories / avg HR / notes.
//
// Props:
//   open      — whether the modal is visible
//   onClose   — () => void, called for backdrop tap, X, or Cancel
//   onSave    — (entry) => void; entry is the API-shaped payload
//                 { cardio_type, duration_secs, distance_m?, calories?,
//                   avg_heart_rate?, notes?, metadata }
//
// The component is purely presentational — it does NOT call the API itself.
// Caller is responsible for the POST and for closing the modal once the
// network round-trip resolves (so we can show error states if needed).

// Field defs per machine. `unit` is informational (rendered as a suffix).
// `optional` fields render but don't fail validation if blank. Universal
// fields (calories, HR, notes) are added below regardless of machine.
const MACHINES = [
  {
    type: 'treadmill',
    label: 'Treadmill',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'speed_mph', label: 'Speed', unit: 'mph', step: '0.1' },
      { key: 'incline_pct', label: 'Incline', unit: '%', step: '0.5' },
      { key: 'distance_mi', label: 'Distance', unit: 'mi', step: '0.01', optional: true },
    ],
  },
  {
    type: 'elliptical',
    label: 'Elliptical',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'resistance_level', label: 'Resistance', unit: 'lvl', step: '1' },
      { key: 'distance_mi', label: 'Distance', unit: 'mi', step: '0.01', optional: true },
    ],
  },
  {
    type: 'stationary_bike',
    label: 'Stationary Bike',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'resistance_level', label: 'Resistance', unit: 'lvl', step: '1' },
      { key: 'distance_mi', label: 'Distance', unit: 'mi', step: '0.01', optional: true },
    ],
  },
  {
    type: 'stair_master',
    label: 'StairMaster',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'level', label: 'Level', unit: 'lvl', step: '1' },
      { key: 'floors', label: 'Floors', unit: '', step: '1', optional: true },
    ],
  },
  {
    type: 'rowing',
    label: 'Rowing',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'distance_m_input', label: 'Distance', unit: 'm', step: '1' },
      { key: 'pace_split', label: 'Pace', unit: '/500m', step: '0.01', optional: true, type: 'text', placeholder: '2:05' },
      { key: 'stroke_rate', label: 'Stroke rate', unit: 'spm', step: '1', optional: true },
    ],
  },
  {
    type: 'assault_bike',
    label: 'Assault Bike',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'distance_mi', label: 'Distance', unit: 'mi', step: '0.01', optional: true },
      { key: 'rpm', label: 'RPM', unit: 'rpm', step: '1', optional: true },
    ],
  },
  {
    type: 'jogging',
    label: 'Jogging',
    fields: [
      { key: 'duration_min', label: 'Time', unit: 'min', step: '0.1' },
      { key: 'distance_mi', label: 'Distance', unit: 'mi', step: '0.01' },
      { key: 'pace_min_mi', label: 'Pace', unit: '/mi', step: '0.01', optional: true, type: 'text', placeholder: '8:30' },
    ],
  },
];

// Convert UI form values → API payload shape. Universal fields are extracted
// to top-level columns; everything machine-specific goes into metadata.
function buildPayload(machineType, values, more) {
  const machine = MACHINES.find((m) => m.type === machineType);
  if (!machine) return null;

  const duration_min = Number(values.duration_min);
  if (!Number.isFinite(duration_min) || duration_min <= 0) {
    return { error: 'Time is required and must be greater than 0' };
  }
  const duration_secs = Math.round(duration_min * 60);

  let distance_m = null;
  if (values.distance_mi != null && values.distance_mi !== '') {
    const mi = Number(values.distance_mi);
    if (Number.isFinite(mi) && mi >= 0) distance_m = +(mi * 1609.344).toFixed(2);
  }
  if (values.distance_m_input != null && values.distance_m_input !== '') {
    const m = Number(values.distance_m_input);
    if (Number.isFinite(m) && m >= 0) distance_m = m;
  }

  // Anything not in the universal-extracted set goes into metadata, with the
  // raw user value preserved (so we can render it back exactly as entered).
  const universalKeys = new Set(['duration_min', 'distance_mi', 'distance_m_input']);
  const metadata = {};
  for (const f of machine.fields) {
    if (universalKeys.has(f.key)) continue;
    const v = values[f.key];
    if (v == null || v === '') continue;
    // Numeric fields stored as numbers; text (pace) as strings
    metadata[f.key] = f.type === 'text' ? String(v).trim() : Number(v);
  }

  const calories = more.calories === '' ? null : Math.round(Number(more.calories));
  const avg_heart_rate = more.avg_heart_rate === '' ? null : Math.round(Number(more.avg_heart_rate));
  const notes = more.notes && more.notes.trim() ? more.notes.trim() : null;

  return {
    cardio_type: machineType,
    duration_secs,
    distance_m,
    calories: Number.isFinite(calories) ? calories : null,
    avg_heart_rate: Number.isFinite(avg_heart_rate) ? avg_heart_rate : null,
    notes,
    metadata,
  };
}

export default function AddCardioModal({ open, onClose, onSave }) {
  const [step, setStep] = useState('pick'); // 'pick' | 'fill'
  const [machineType, setMachineType] = useState(null);
  const [values, setValues] = useState({});
  const [more, setMore] = useState({ calories: '', avg_heart_rate: '', notes: '' });
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset everything whenever the modal opens
  useEffect(() => {
    if (open) {
      setStep('pick');
      setMachineType(null);
      setValues({});
      setMore({ calories: '', avg_heart_rate: '', notes: '' });
      setShowMore(false);
      setSubmitting(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const machine = MACHINES.find((m) => m.type === machineType);

  async function handleSave() {
    setError('');
    const payload = buildPayload(machineType, values, more);
    if (!payload || payload.error) {
      setError(payload?.error || 'Invalid input');
      return;
    }
    setSubmitting(true);
    try {
      await onSave(payload);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-wf-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            {step === 'fill' && (
              <button
                type="button"
                onClick={() => setStep('pick')}
                aria-label="Back"
                className="-ml-1 p-1 rounded-full hover:bg-white/10 active:bg-white/20"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                {step === 'pick' ? 'Add Cardio' : machine?.label || 'Cardio'}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                {step === 'pick' ? 'Choose a machine' : 'Log your session'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full hover:bg-white/10 active:bg-white/20"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'pick' ? (
            <div className="grid grid-cols-2 gap-3">
              {MACHINES.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => {
                    setMachineType(m.type);
                    setValues({});
                    setStep('fill');
                  }}
                  className="text-left rounded-xl border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 active:scale-[0.98] transition-all p-4"
                >
                  <div className="text-sm font-bold text-white mb-1">{m.label}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    {m.fields.filter((f) => !f.optional).length} fields
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              {machine.fields.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`cardio-${f.key}`} className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
                    {f.label}
                    {!f.optional && <span className="text-cyan-400 ml-1">*</span>}
                    {f.unit && <span className="text-white/30 normal-case ml-2 tracking-normal">({f.unit})</span>}
                  </label>
                  <input
                    id={`cardio-${f.key}`}
                    type={f.type === 'text' ? 'text' : 'number'}
                    inputMode={f.type === 'text' ? 'text' : 'decimal'}
                    step={f.step}
                    placeholder={f.placeholder || ''}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                  />
                </div>
              ))}

              {/* Universal fields — collapsed by default */}
              <div className="pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowMore(!showMore)}
                  className="w-full flex items-center justify-between py-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/60"
                  aria-expanded={showMore}
                >
                  <span>More (calories, heart rate, notes)</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {showMore && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label htmlFor="cardio-calories" className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
                        Calories <span className="text-white/30 normal-case ml-2 tracking-normal">(kcal)</span>
                      </label>
                      <input
                        id="cardio-calories"
                        type="number"
                        inputMode="numeric"
                        value={more.calories}
                        onChange={(e) => setMore({ ...more, calories: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                      />
                    </div>
                    <div>
                      <label htmlFor="cardio-hr" className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
                        Avg Heart Rate <span className="text-white/30 normal-case ml-2 tracking-normal">(bpm)</span>
                      </label>
                      <input
                        id="cardio-hr"
                        type="number"
                        inputMode="numeric"
                        value={more.avg_heart_rate}
                        onChange={(e) => setMore({ ...more, avg_heart_rate: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                      />
                    </div>
                    <div>
                      <label htmlFor="cardio-notes" className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
                        Notes
                      </label>
                      <textarea
                        id="cardio-notes"
                        rows={2}
                        value={more.notes}
                        onChange={(e) => setMore({ ...more, notes: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'fill' && (
          <div className="border-t border-white/10 px-5 py-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl border border-white/15 text-sm font-semibold text-white/80 hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:scale-[0.98] transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                boxShadow: '0 4px 14px rgba(6,182,212,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {submitting ? 'Saving…' : 'Save Cardio'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { MACHINES };
