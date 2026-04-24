import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { api, setApiToken, setAuthTokens, getApiToken } from '../api';
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
  const { user, logout, updateUser } = useAuth();
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
  const [bibleVersesOn, setBibleVersesOn] = useState(() => localStorage.getItem('wf-bible-verses') !== 'off');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  // Stats & Streak card data — moved from Workouts page.
  const [prStats, setPrStats] = useState(null);
  const [bodyPartPRs, setBodyPartPRs] = useState([]);
  const [streakPhase, setStreakPhase] = useState(0);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    localStorage.setItem('wf-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('wf-bible-verses', bibleVersesOn ? 'on' : 'off');
  }, [bibleVersesOn]);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    api('/metrics', opts)
      .then(setMetrics)
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); });
    api('/sessions', opts)
      .then(setSessions)
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); })
      .finally(() => setSessionsLoading(false));
    api('/pbs/stats', opts)
      .then(setPrStats)
      .catch(() => {});
    api('/pbs/by-body-part', opts)
      .then(setBodyPartPRs)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Derive streak from sessions — consecutive days going back from today.
  const streak = (() => {
    if (!sessions || sessions.length === 0) return 0;
    const sessionDates = new Set(sessions.map((s) => s.date));
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let cursor = new Date(today);
    if (!sessionDates.has(fmt(today))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    for (;; cursor.setDate(cursor.getDate() - 1)) {
      if (sessionDates.has(fmt(cursor))) count++;
      else break;
    }
    return count;
  })();

  // Breathing blob animation for the Stats card.
  useEffect(() => {
    if (streak <= 0 && !(prStats && prStats.totalPRs > 0)) return;
    const interval = setInterval(() => setStreakPhase((p) => (p + 1) % 100), 80);
    return () => clearInterval(interval);
  }, [streak, prStats]);

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
      await api('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          type: feedbackType === 'bug' ? 'Bug Report' : 'Improvement Idea',
          message: feedbackMsg.trim(),
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

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api('/auth/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  }

  function resizeAndCropImage(file, maxSize = 256) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext('2d');
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingPhoto(true);
    setShowPhotoMenu(false);
    try {
      const photo = await resizeAndCropImage(file);
      const result = await api('/auth/profile-photo', {
        method: 'PUT',
        body: JSON.stringify({ photo }),
      });
      updateUser({ ...user, photoUrl: result.photoUrl });
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    setShowPhotoMenu(false);
    setUploadingPhoto(true);
    try {
      await api('/auth/profile-photo', { method: 'DELETE' });
      updateUser({ ...user, photoUrl: null });
    } catch (err) {
      console.error('Failed to remove photo:', err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div>
      <StickyHeader title="PROFILE" titleStyle={{ fontSize: '26.4px' }} />

      <div className="px-4 pb-24">
        {/* Member Info — Nike style */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Red accent line */}
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          {/* Ambient spotlight */}
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

          <div className="relative p-6">
            {/* Avatar */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setShowPhotoMenu(true)}
                aria-label="Change profile photo"
                className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 active:scale-95 transition-transform"
              >
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-wf-red/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-wf-red">
                      {(user?.firstName || user?.email || user?.phone || 'W')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {uploadingPhoto ? (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-end pb-0.5 pr-0.5">
                    <div className="w-5 h-5 rounded-full bg-wf-red flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.3em' }}>
                  RepLab Member
                </p>
                <h2 className="text-[22px] font-black text-white tracking-tight leading-[0.95] truncate">
                  {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : (user?.email || user?.phone || 'User')}
                </h2>
                {user?.firstName && (
                  <p className="text-[12px] text-white/35 font-light mt-1 truncate">{user?.email || user?.phone}</p>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              {user?.username && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] uppercase font-semibold text-white/30" style={{ letterSpacing: '0.25em' }}>Username</span>
                  <span className="text-white text-[13px] font-medium truncate">@{user.username}</span>
                </div>
              )}
              {user?.email && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] uppercase font-semibold text-white/30" style={{ letterSpacing: '0.25em' }}>Email</span>
                  <span className="text-white text-[13px] font-medium truncate">{user.email}</span>
                </div>
              )}
              {user?.phone && (
                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] uppercase font-semibold text-white/30" style={{ letterSpacing: '0.25em' }}>Phone</span>
                  <span className="text-white text-[13px] font-medium truncate">{user.phone}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] uppercase font-semibold text-white/30" style={{ letterSpacing: '0.25em' }}>Account ID</span>
                <span className="text-white/50 text-[13px] font-medium tabular-nums">#{user?.id}</span>
              </div>
            </div>
          </div>
        </div>

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
                className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-3.5 py-2 whitespace-nowrap shrink-0 self-center"
                style={{
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
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

        {/* Stats & Streak — Organic Blob Card (moved from Workouts page) */}
        {(streak > 0 || (prStats && prStats.totalPRs > 0)) && (
          <div className="fade-slide-up mb-4" style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0e 50%, #0a0808 100%)',
            borderRadius: '24px',
            padding: '28px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Animated blob */}
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              width: '180px',
              height: '180px',
              transform: `translate(-50%, -50%) scale(${0.8 + Math.sin(streakPhase * 0.063) * 0.2})`,
              borderRadius: `${40 + Math.sin(streakPhase * 0.04) * 15}% ${60 - Math.sin(streakPhase * 0.04) * 15}% ${50 + Math.cos(streakPhase * 0.05) * 10}% ${50 - Math.cos(streakPhase * 0.05) * 10}%`,
              background: 'radial-gradient(circle, rgba(249,115,22,0.4) 0%, rgba(239,68,68,0.2) 50%, transparent 70%)',
              filter: 'blur(20px)',
              transition: 'all 0.08s linear',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Streak + PRs row */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '20px' }}>
                {streak > 0 && (
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '42px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>
                      {streak}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(249,115,22,0.6)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
                      Day Streak
                    </div>
                  </div>
                )}
                {prStats && prStats.totalPRs > 0 && (
                  <>
                    {streak > 0 && <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />}
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '42px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>
                        {prStats.totalPRs}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(239,68,68,0.6)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
                        Total PRs
                      </div>
                    </div>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '42px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>
                        {prStats.prsThisMonth}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(34,197,94,0.6)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
                        This Month
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Heaviest Lifts by body part */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '14px', textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>
                  Heaviest Lifts
                </div>
                {['Chest', 'Back', 'Shoulders', 'Quads', 'Biceps', 'Triceps'].map((muscle, i, arr) => {
                  const pr = bodyPartPRs.find((p) => p.muscle_group?.toLowerCase() === muscle.toLowerCase());
                  return (
                    <div key={muscle} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: i < arr.length - 1 ? '10px' : '0' }}>
                      <span style={{ flex: '0 0 33.333%', fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', paddingTop: '1px' }}>{muscle}</span>
                      {pr ? (
                        <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'white', textShadow: '0 0 8px rgba(239,68,68,0.5)', wordBreak: 'break-word' }}>
                          {pr.exercise_name} — {Number(pr.best_weight)} lbs × {pr.best_reps} reps
                        </span>
                      ) : (
                        <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
                          No PR set
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* App Settings — Nike style */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #9ca3af, rgba(156,163,175,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(156,163,175,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(156,163,175,0.85)', letterSpacing: '0.3em' }}>Preferences</p>
            <h3 className="text-[22px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>APP SETTINGS</h3>
            <div className="pt-3 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4.5 h-4.5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-white/70 text-sm font-medium">Bible Verses</span>
                </div>
                <button
                  onClick={() => setBibleVersesOn(!bibleVersesOn)}
                  aria-label={bibleVersesOn ? 'Turn off Bible verses' : 'Turn on Bible verses'}
                  className={`relative w-12 h-7 rounded-full transition-colors ${bibleVersesOn ? 'bg-wf-red' : 'bg-white/15'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${bibleVersesOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
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
                  <span className="text-white/70 text-sm font-medium">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className={`relative w-12 h-7 rounded-full transition-colors ${theme === 'light' ? 'bg-wf-red' : 'bg-white/15'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${theme === 'light' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Body Metrics — Nike style */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            animationDelay: '60ms',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(34,197,94,0.85)', letterSpacing: '0.3em' }}>Your Body</p>
            <h3 className="text-[22px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>BODY METRICS</h3>
            <div className="space-y-3 pt-3 border-t border-white/10">
              <MetricInput label="Height" value={metrics.height} unit="in" onChange={(v) => updateMetric('height', v)} />
              <MetricInput label="Weight" value={metrics.weight} unit="lbs" onChange={(v) => updateMetric('weight', v)} />
              <MetricInput label="Body Fat" value={metrics.bodyFat} unit="%" onChange={(v) => updateMetric('bodyFat', v)} />
            </div>
          </div>
        </div>

        {/* Performance Metrics — Nike style */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            animationDelay: '120ms',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>1 Rep Max</p>
            <h3 className="text-[22px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>PERFORMANCE</h3>
            <div className="space-y-3 pt-3 border-t border-white/10">
              <MetricInput label="Bench Press" value={metrics.maxBench} unit="lbs" onChange={(v) => updateMetric('maxBench', v)} />
              <MetricInput label="Squat" value={metrics.maxSquat} unit="lbs" onChange={(v) => updateMetric('maxSquat', v)} />
              <MetricInput label="Deadlift" value={metrics.maxDeadlift} unit="lbs" onChange={(v) => updateMetric('maxDeadlift', v)} />
            </div>
          </div>
        </div>

        {/* Save Metrics Button — matches Send Feedback style */}
        <button
          onClick={handleSaveMetrics}
          disabled={saving}
          className="w-full active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase py-3.5 mb-4 fade-slide-up disabled:opacity-50 whitespace-nowrap"
          style={{
            animationDelay: '180ms',
            letterSpacing: '0.15em',
            borderRadius: '2px',
            background: saved
              ? 'linear-gradient(135deg, rgba(34,197,94,0.9) 0%, rgba(22,163,74,0.9) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
            boxShadow: saved
              ? '0 4px 14px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Metrics'}
        </button>

        {/* Workout History — Nike style */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            animationDelay: '180ms',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #f97316, rgba(249,115,22,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(249,115,22,0.85)', letterSpacing: '0.3em' }}>Sessions</p>
            <h3 className="text-[22px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>WORKOUT HISTORY</h3>

            {sessionsLoading ? (
              <div className="space-y-2 pt-3 border-t border-white/10">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-skeleton rounded-sm h-16" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4 pt-3 border-t border-white/10">No workouts logged yet</p>
            ) : (
              <div className="pt-3 border-t border-white/10">
                {/* Scrollable list — sized to show ~4.5 workouts so the next row peeks as a scroll hint */}
                <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '260px' }}>
                  {sessions.slice(0, 10).map((session) => {
                    const color = getWorkoutColor(session.templateName);
                    return (
                      <button
                        key={session.id}
                        onClick={() => navigate(`/history/${session.id}`)}
                        className={`w-full text-left p-3 active:scale-[0.98] transition-transform border-l-[3px] ${color.border}`}
                        style={{
                          borderRadius: '2px',
                          background: 'rgba(255,255,255,0.04)',
                        }}
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
                {sessions.length > 10 && (
                  <button
                    onClick={() => navigate('/history')}
                    className="w-full text-center text-[10px] font-bold uppercase py-3 mt-2 active:opacity-70"
                    style={{ color: 'rgba(249,115,22,0.9)', letterSpacing: '0.3em' }}
                  >
                    View all {sessions.length} sessions
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* App Info */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-base font-semibold text-white mb-3">About</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">App</span>
              <span className="text-white text-sm">REPLAB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Version</span>
              <span className="text-wf-gray-500 text-sm">{APP_VERSION}</span>
            </div>
            {user?.email && ['willmartinmail@gmail.com', 'abilenerentals@gmail.com'].includes(user.email.toLowerCase()) && (
              <>
                <button
                  onClick={() => setShowSplash(true)}
                  className="w-full mt-2 glass-card text-wf-gray-400 text-sm font-medium py-2.5 rounded-xl transition-all active:scale-[0.98] hover:text-white"
                >
                  Load Screen
                </button>
                <button
                  onClick={() => navigate('/test')}
                  className="w-full mt-2 glass-card text-wf-gray-400 text-sm font-medium py-2.5 rounded-xl transition-all active:scale-[0.98] hover:text-white"
                >
                  Test
                </button>
              </>
            )}
          </div>
        </div>

        {/* Change Password — Nike style */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #9ca3af, rgba(156,163,175,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(156,163,175,0.06) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <button
              onClick={() => { setShowChangePassword(!showChangePassword); setPasswordError(''); setPasswordChanged(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h3 className="text-[22px] font-black tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', color: '#e5e7eb' }}>SECURITY</h3>
                <p className="text-[10px] uppercase font-light mt-1" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.9)' }}>Change Password</p>
              </div>
              <svg className={`w-5 h-5 text-white/40 transition-transform shrink-0 ml-3 ${showChangePassword ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showChangePassword && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                {passwordError && (
                  <div className="px-4 py-3 text-red-300 text-sm" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(153,27,27,0.6)', borderRadius: '2px' }}>
                    {passwordError}
                  </div>
                )}
                {passwordChanged && (
                  <div className="px-4 py-3 text-green-300 text-sm" style={{ background: 'rgba(20,83,45,0.3)', border: '1px solid rgba(22,101,52,0.6)', borderRadius: '2px' }}>
                    Password changed successfully!
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-white/40 uppercase mb-1.5 block font-semibold" style={{ letterSpacing: '0.25em' }}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase mb-1.5 block font-semibold" style={{ letterSpacing: '0.25em' }}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase mb-1.5 block font-semibold" style={{ letterSpacing: '0.25em' }}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <button
                  onClick={async () => {
                    setPasswordError('');
                    setPasswordChanged(false);
                    const pe = [];
                    if (newPassword.length < 8) pe.push('at least 8 characters');
                    if (!/[A-Z]/.test(newPassword)) pe.push('at least 1 uppercase letter');
                    if (!/[0-9]/.test(newPassword)) pe.push('at least 1 number');
                    if (/\s/.test(newPassword)) pe.push('no spaces');
                    if (pe.length > 0) {
                      setPasswordError('Password must have: ' + pe.join(', '));
                      return;
                    }
                    if (newPassword !== confirmNewPassword) {
                      setPasswordError('New passwords do not match');
                      return;
                    }
                    setPasswordSaving(true);
                    try {
                      const resp = await api('/auth/change-password', {
                        method: 'POST',
                        body: JSON.stringify({ currentPassword, newPassword }),
                      });
                      // Server bumps tokenVersion on password change, invalidating
                      // every existing access + refresh JWT. The response includes
                      // a fresh pair so THIS session stays signed in while other
                      // sessions are kicked out on their next request.
                      if (resp) setAuthTokens(resp);
                      setPasswordChanged(true);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                    } catch (err) {
                      setPasswordError(err.message);
                    } finally {
                      setPasswordSaving(false);
                    }
                  }}
                  disabled={passwordSaving || !currentPassword || !newPassword || !confirmNewPassword}
                  className="w-full active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase py-3.5 disabled:opacity-50 whitespace-nowrap"
                  style={{
                    letterSpacing: '0.15em',
                    borderRadius: '2px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  {passwordSaving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Logout — matches Send Feedback button */}
        <button
          onClick={handleLogout}
          className="w-full active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase py-3.5 mb-4 fade-slide-up whitespace-nowrap"
          style={{
            animationDelay: '360ms',
            letterSpacing: '0.15em',
            borderRadius: '2px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
            boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          Sign Out
        </button>

        {/* Export Data & Delete Account */}
        <div className="flex justify-center gap-4 mb-4 fade-slide-up" style={{ animationDelay: '400ms' }}>
          <button
            onClick={async () => {
              try {
                // Use getApiToken() so we pick up the in-memory token after a
                // mid-session refresh (localStorage may be a tick behind).
                const token = getApiToken();
                const res = await fetch('/auth/export-data', { headers: { Authorization: `Bearer ${token}` } });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `replab-data-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* silently fail */ }
            }}
            className="text-sm text-wf-gray-500 hover:text-wf-gray-300 transition-colors"
          >
            Export My Data
          </button>
          <span className="text-wf-gray-700">|</span>
          <button
            onClick={() => { setShowDeleteAccount(true); setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); }}
            className="text-sm text-wf-gray-500 hover:text-red-400 transition-colors"
          >
            Delete Account
          </button>
        </div>

        {/* Legal links */}
        <div className="flex justify-center gap-4 mb-6 fade-slide-up" style={{ animationDelay: '440ms' }}>
          <Link to="/terms" className="text-xs text-wf-gray-500 hover:text-wf-gray-300 transition-colors">Terms of Service</Link>
          <span className="text-wf-gray-700">|</span>
          <Link to="/privacy" className="text-xs text-wf-gray-500 hover:text-wf-gray-300 transition-colors">Privacy Policy</Link>
        </div>
      </div>

      {showSplash && (
        <div onClick={() => setShowSplash(false)} className="cursor-pointer">
          <SplashScreen onDone={() => {}} persistent />
        </div>
      )}

      {/* Photo Menu Modal */}
      {showPhotoMenu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowPhotoMenu(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {user?.photoUrl ? (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-5 py-4 text-left text-sm font-semibold text-white active:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Change Photo
                </button>
                <div className="border-t border-white/10" />
                <button
                  onClick={handleRemovePhoto}
                  className="w-full px-5 py-4 text-left text-sm font-semibold text-wf-red active:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Remove Photo
                </button>
              </>
            ) : (
              <button
                onClick={() => { setShowPhotoMenu(false); fileInputRef.current?.click(); }}
                className="w-full px-5 py-4 text-left text-sm font-semibold text-white active:bg-white/5 transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                Upload Photo
              </button>
            )}
            <div className="border-t border-white/10" />
            <button
              onClick={() => setShowPhotoMenu(false)}
              className="w-full px-5 py-4 text-center text-sm font-medium text-wf-gray-400 active:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowDeleteAccount(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white text-center">Delete Account</h3>
              <p className="text-sm text-wf-gray-400 text-center mt-2">
                This will permanently delete your account and all your data including workouts, programs, and history. This cannot be undone.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-wf-gray-500 mb-1 block">Enter your password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Password"
                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-wf-gray-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-wf-gray-500 mb-1 block">Type <span className="text-red-400 font-semibold">DELETE</span> to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-wf-gray-600 focus:outline-none"
                  />
                </div>
              </div>

              {deleteError && (
                <p className="text-sm text-red-400 text-center mt-3">{deleteError}</p>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowDeleteAccount(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className={`flex-1 py-3 rounded-xl bg-red-500 text-sm font-semibold text-white active:scale-[0.98] transition-all ${deleteConfirmText !== 'DELETE' || deleting ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
