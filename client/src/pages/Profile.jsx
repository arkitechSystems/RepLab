import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import StickyHeader from '../components/StickyHeader';
import SplashScreen from '../components/SplashScreen';
import { APP_VERSION } from '../version';
import { getWorkoutColor } from '../utils/workoutColors';

function MetricInput({ label, value, unit, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-wf-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="—"
          className="w-20 glass-input rounded-lg px-2 py-1.5 text-white text-sm text-right font-medium focus:outline-none transition-all placeholder:text-wf-gray-600"
        />
        {unit && <span className="text-wf-gray-500 text-xs w-6">{unit}</span>}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    height: null,
    weight: null,
    bodyFat: null,
    maxBench: null,
    maxSquat: null,
    maxDeadlift: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    api('/metrics')
      .then(setMetrics)
      .catch(console.error);
    api('/sessions')
      .then(setSessions)
      .catch(console.error)
      .finally(() => setSessionsLoading(false));
  }, []);

  function updateMetric(field, value) {
    setMetrics((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveMetrics() {
    setSaving(true);
    try {
      const result = await api('/metrics', {
        method: 'PUT',
        body: JSON.stringify(metrics),
      });
      setMetrics(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div>
      <StickyHeader title="Profile" />

      <div className="px-4">
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-wf-red/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-wf-red">
                {user?.email?.[0]?.toUpperCase() || 'W'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{user?.email || 'User'}</h2>
              <p className="text-wf-gray-400 text-sm">WILLFIT Member</p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Email</span>
              <span className="text-white text-sm">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Account ID</span>
              <span className="text-wf-gray-500 text-sm">#{user?.id}</span>
            </div>
          </div>
        </div>

        {/* Body Metrics */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-wf-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <h3 className="text-base font-semibold text-white">Body Metrics</h3>
          </div>
          <div className="space-y-3">
            <MetricInput label="Height" value={metrics.height} unit="in" onChange={(v) => updateMetric('height', v)} />
            <MetricInput label="Weight" value={metrics.weight} unit="lbs" onChange={(v) => updateMetric('weight', v)} />
            <MetricInput label="Body Fat" value={metrics.bodyFat} unit="%" onChange={(v) => updateMetric('bodyFat', v)} />
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <h3 className="text-base font-semibold text-white">Performance (1RM)</h3>
          </div>
          <div className="space-y-3">
            <MetricInput label="Bench Press" value={metrics.maxBench} unit="lbs" onChange={(v) => updateMetric('maxBench', v)} />
            <MetricInput label="Squat" value={metrics.maxSquat} unit="lbs" onChange={(v) => updateMetric('maxSquat', v)} />
            <MetricInput label="Deadlift" value={metrics.maxDeadlift} unit="lbs" onChange={(v) => updateMetric('maxDeadlift', v)} />
          </div>
        </div>

        {/* Save Metrics Button */}
        <button
          onClick={handleSaveMetrics}
          disabled={saving}
          className={`w-full font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] mb-4 fade-slide-up ${
            saved
              ? 'bg-green-600 text-white'
              : 'btn-gradient text-white'
          } disabled:opacity-50`}
          style={{ animationDelay: '180ms' }}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Metrics'}
        </button>

        {/* Workout History */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-wf-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-base font-semibold text-white">Workout History</h3>
          </div>

          {sessionsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-skeleton rounded-xl h-16" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-wf-gray-500 text-sm text-center py-4">No workouts logged yet</p>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 10).map((session) => {
                const color = getWorkoutColor(session.templateName);
                return (
                  <button
                    key={session.id}
                    onClick={() => navigate(`/history/${session.id}`)}
                    className={`w-full text-left glass-card rounded-xl p-3 active:scale-[0.98] transition-transform border-l-4 ${color.border}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                          <h4 className="text-sm font-semibold text-white">{session.templateName}</h4>
                        </div>
                        <p className="text-wf-gray-400 text-xs mt-0.5 ml-4">
                          {format(parseISO(session.date), 'EEEE, MMM d, yyyy')}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </button>
                );
              })}
              {sessions.length > 10 && (
                <button
                  onClick={() => navigate('/history')}
                  className="w-full text-center text-wf-red text-sm font-medium py-2 active:opacity-70"
                >
                  View all {sessions.length} sessions
                </button>
              )}
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-base font-semibold text-white mb-3">About</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">App</span>
              <span className="text-white text-sm">WILLFIT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Version</span>
              <span className="text-wf-gray-500 text-sm">{APP_VERSION}</span>
            </div>
            <button
              onClick={() => setShowSplash(true)}
              className="w-full mt-2 glass-card text-wf-gray-400 text-sm font-medium py-2.5 rounded-xl transition-all active:scale-[0.98] hover:text-white"
            >
              Load Screen
            </button>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full glass-card !border-red-800/50 hover:!border-red-700 text-wf-red font-semibold py-4 rounded-xl text-base transition-all active:scale-[0.98] mb-6 fade-slide-up"
          style={{ animationDelay: '360ms' }}
        >
          Sign Out
        </button>
      </div>

      {showSplash && (
        <div onClick={() => setShowSplash(false)} className="cursor-pointer">
          <SplashScreen onDone={() => {}} persistent />
        </div>
      )}
    </div>
  );
}
