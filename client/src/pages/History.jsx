import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';
import LoadingSpinnerOverlay from '../components/LoadingSpinnerOverlay';
import useCountUp from '../hooks/useCountUp';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const navigate = useNavigate();

  const sessionCount = useCountUp(sessions.length);
  const uniqueWorkouts = useCountUp([...new Set(sessions.map((s) => s.templateName))].length);

  useEffect(() => {
    const controller = new AbortController();
    api('/sessions', { signal: controller.signal })
      .then(setSessions)
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load session history'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const ACCENT = '#f97316'; // orange — matches the WORKOUT HISTORY block on Profile

  return (
    <div className="pb-24">
      <StickyHeader title="History" />

      <div className="px-4">
        {/* Nike-style stats grid */}
        {!loading && sessions.length > 0 && (() => {
          const panel = {
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden',
          };
          const stripe = (color) => ({
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: `linear-gradient(90deg, ${color}, ${color}40 60%, transparent)`,
          });
          const stats = [
            { label: 'Sessions',  color: ACCENT,  main: String(sessionCount) },
            { label: 'Workouts',  color: '#22c55e', main: String(uniqueWorkouts) },
          ];
          return (
            <div className="grid grid-cols-2 gap-3 mb-4 fade-slide-up">
              {stats.map((s) => (
                <div key={s.label} className="px-4 py-4" style={panel}>
                  <div style={stripe(s.color)} />
                  <p className="text-[9px] uppercase font-bold mt-1 mb-2" style={{ color: s.color, letterSpacing: '0.25em' }}>
                    {s.label}
                  </p>
                  <p
                    className="font-black text-white tabular-nums"
                    style={{ fontFamily: 'system-ui', fontSize: '28px', lineHeight: '1', letterSpacing: '-0.02em' }}
                  >
                    {s.main}
                  </p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Sessions panel — Nike style: black gradient + orange accent */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}40, transparent)` }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: `radial-gradient(circle, ${ACCENT}15 0%, transparent 60%)`, filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(249,115,22,0.85)', letterSpacing: '0.3em' }}>Sessions</p>
            <h3 className="text-[22px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>WORKOUT HISTORY</h3>

            {loading ? (
              <div className="pt-3 border-t border-white/10 space-y-2 relative">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="glass-skeleton rounded-sm h-16" />
                ))}
                <LoadingSpinnerOverlay />
              </div>
            ) : loadError ? (
              <div className="pt-3 border-t border-white/10 text-center py-8">
                <p className="text-red-400 mb-3">{loadError}</p>
                <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="pt-3 border-t border-white/10 text-center py-12">
                <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-wf-gray-400 text-base">No workouts logged yet</p>
                <p className="text-wf-gray-500 text-sm mt-1">Complete a workout to see it here</p>
              </div>
            ) : (
              <div className="pt-3 border-t border-white/10 space-y-2">
                {sessions.map((session, idx) => {
                  const color = getWorkoutColor(session.templateName);
                  return (
                    <button
                      key={session.id}
                      onClick={() => navigate(`/summary/${session.id}`)}
                      style={{
                        animationDelay: `${Math.min(idx * 40, 400)}ms`,
                        borderRadius: '2px',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                      className={`w-full text-left p-3 active:scale-[0.98] transition-transform fade-slide-up border-l-[3px] ${color.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                            <h4 className="text-sm font-semibold text-white">{session.templateName}</h4>
                          </div>
                          <p className="text-white/40 text-xs mt-0.5 ml-4">
                            {format(parseISO(session.date), 'EEEE, MMM d, yyyy')}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
