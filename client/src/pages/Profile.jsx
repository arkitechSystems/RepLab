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
  const [theme, setTheme] = useState(() => localStorage.getItem('wf-theme') || 'dark');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    localStorage.setItem('wf-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;
    setFeedbackSending(true);
    try {
      await fetch('https://formsubmit.co/ajax/arkitechcloud@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `WillFit Feedback: ${feedbackType === 'bug' ? 'Bug Report' : 'Improvement Idea'}`,
          type: feedbackType === 'bug' ? 'Bug Report' : 'Improvement Idea',
          message: feedbackMsg.trim(),
          user: user?.name || user?.email || 'Unknown',
          version: APP_VERSION,
        }),
      });
      setFeedbackSent(true);
      setFeedbackMsg('');
      setTimeout(() => {
        setFeedbackSent(false);
        setShowFeedback(false);
      }, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setFeedbackSending(false);
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
        {/* Beta banner + feedback */}
        <div className="glass-card rounded-xl p-4 mb-4 fade-slide-up border border-wf-red/20 bg-wf-red/5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-wf-red/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Alpha Version</p>
              <p className="text-xs text-wf-gray-400 mt-0.5 leading-relaxed">This is the alpha version of the app. Send us any bugs or improvement ideas you have!</p>
            </div>
            {!showFeedback && (
              <button
                onClick={() => setShowFeedback(true)}
                className="btn-gradient text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all shrink-0 self-center"
              >
                Send Feedback
              </button>
            )}
          </div>

          {showFeedback && (
            <form onSubmit={handleFeedbackSubmit} className="mt-4 border-t border-white/10 pt-4">
              {feedbackSent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">Thanks for your feedback!</p>
                  <p className="text-xs text-wf-gray-400 mt-1">We'll review it shortly.</p>
                </div>
              ) : (
                <>
                  {/* Type selector */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setFeedbackType('bug')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        feedbackType === 'bug'
                          ? 'bg-wf-red/20 border border-wf-red/40 text-wf-red'
                          : 'glass-card text-wf-gray-400'
                      }`}
                    >
                      Bug Report
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('idea')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        feedbackType === 'idea'
                          ? 'bg-wf-blue/20 border border-wf-blue/40 text-wf-blue'
                          : 'glass-card text-wf-gray-400'
                      }`}
                    >
                      Improvement Idea
                    </button>
                  </div>

                  {/* Message */}
                  <textarea
                    value={feedbackMsg}
                    onChange={(e) => setFeedbackMsg(e.target.value)}
                    placeholder={feedbackType === 'bug' ? 'Describe the bug...' : 'Share your idea...'}
                    rows={3}
                    className="w-full glass-input rounded-xl px-3 py-3 text-white text-sm focus:outline-none resize-none placeholder:text-wf-gray-600"
                  />

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => { setShowFeedback(false); setFeedbackMsg(''); }}
                      className="flex-1 glass-card text-wf-gray-400 font-semibold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!feedbackMsg.trim() || feedbackSending}
                      className="flex-1 btn-gradient text-white font-semibold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-all disabled:opacity-40"
                    >
                      {feedbackSending ? 'Sending...' : 'Submit'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>

        {/* App Settings */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-base font-semibold text-white">App Settings</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <svg className="w-4.5 h-4.5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg className="w-4.5 h-4.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
              <span className="text-wf-gray-400 text-sm">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative w-12 h-7 rounded-full transition-colors ${theme === 'light' ? 'bg-wf-red' : 'bg-white/15'}`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${theme === 'light' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up" style={{ animationDelay: '60ms' }}>
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-wf-red/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-wf-red">
                {(user?.email || user?.phone || 'W')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{user?.email || user?.phone || 'User'}</h2>
              <p className="text-wf-gray-400 text-sm">WILLFIT Member</p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 border-t border-white/10 pt-4">
            {user?.email && (
              <div className="flex justify-between items-center">
                <span className="text-wf-gray-400 text-sm">Email</span>
                <span className="text-white text-sm">{user.email}</span>
              </div>
            )}
            {user?.phone && (
              <div className="flex justify-between items-center">
                <span className="text-wf-gray-400 text-sm">Phone</span>
                <span className="text-white text-sm">{user.phone}</span>
              </div>
            )}
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
