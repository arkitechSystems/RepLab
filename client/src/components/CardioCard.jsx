import { MACHINES } from './AddCardioModal';

// Inline display for a saved cardio entry. Compact card, cyan accent so it
// reads as different from strength-training exercise cards. Shows the most
// relevant per-machine fields plus duration; collapses heart rate / calories
// / notes behind a tap-to-expand if any are present.
//
// Props:
//   entry    — { id, cardio_type, duration_secs, distance_m, calories,
//                avg_heart_rate, notes, metadata }
//   onDelete — () => void

function formatDuration(secs) {
  if (!Number.isFinite(secs) || secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatDistance(meters, machineType) {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  // Rowing displays in meters (gym standard); everything else in miles.
  if (machineType === 'rowing') return `${Math.round(meters)} m`;
  const mi = meters / 1609.344;
  return `${mi.toFixed(2)} mi`;
}

// Build the 1-2 most relevant secondary stats per machine to show next to time.
function summarizeMetadata(entry) {
  const md = entry.metadata || {};
  const out = [];
  switch (entry.cardio_type) {
    case 'treadmill':
      if (md.speed_mph != null) out.push(`${md.speed_mph} mph`);
      if (md.incline_pct != null) out.push(`${md.incline_pct}% incline`);
      break;
    case 'elliptical':
      if (md.resistance_level != null) out.push(`Lvl ${md.resistance_level}`);
      break;
    case 'stationary_bike':
      if (md.resistance_level != null) out.push(`Lvl ${md.resistance_level}`);
      break;
    case 'stair_master':
      if (md.level != null) out.push(`Lvl ${md.level}`);
      if (md.floors != null) out.push(`${md.floors} floors`);
      break;
    case 'rowing':
      if (md.pace_split) out.push(`${md.pace_split} /500m`);
      if (md.stroke_rate != null) out.push(`${md.stroke_rate} spm`);
      break;
    case 'assault_bike':
      if (md.rpm != null) out.push(`${md.rpm} rpm`);
      break;
    case 'jogging':
      if (md.pace_min_mi) out.push(`${md.pace_min_mi} /mi`);
      break;
  }
  return out;
}

export default function CardioCard({ entry, onDelete }) {
  const machine = MACHINES.find((m) => m.type === entry.cardio_type);
  const label = machine?.label || entry.cardio_type;
  const distance = formatDistance(Number(entry.distance_m), entry.cardio_type);
  const secondary = summarizeMetadata(entry);
  const hasExtras = entry.calories != null || entry.avg_heart_rate != null || (entry.notes && entry.notes.trim());

  return (
    <div
      className="glass-card rounded-xl overflow-hidden mb-3"
      style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(8,145,178,0.04))',
        border: '1px solid rgba(6,182,212,0.25)',
      }}
    >
      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.15)' }}>
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-white truncate">{label}</div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-300/70">Cardio</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete cardio entry"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Time</span>
          <span className="font-bold text-white tabular-nums">{formatDuration(entry.duration_secs)}</span>
        </div>
        {distance && (
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Dist</span>
            <span className="font-bold text-white tabular-nums">{distance}</span>
          </div>
        )}
        {secondary.map((s) => (
          <span key={s} className="text-xs font-semibold text-cyan-200/80">
            {s}
          </span>
        ))}
      </div>

      {/* Optional extras (calories, HR, notes) — only render the section if any are set */}
      {hasExtras && (
        <div className="px-4 pb-3 pt-2 border-t border-white/5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
          {entry.calories != null && (
            <span><span className="uppercase tracking-widest text-[9px] text-white/40 mr-1">Cal</span><span className="tabular-nums">{entry.calories}</span></span>
          )}
          {entry.avg_heart_rate != null && (
            <span><span className="uppercase tracking-widest text-[9px] text-white/40 mr-1">HR</span><span className="tabular-nums">{entry.avg_heart_rate}</span></span>
          )}
          {entry.notes && entry.notes.trim() && (
            <div className="basis-full text-white/50 italic">"{entry.notes.trim()}"</div>
          )}
        </div>
      )}
    </div>
  );
}
