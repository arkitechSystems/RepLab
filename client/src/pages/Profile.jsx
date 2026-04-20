import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { api, setApiToken } from '../api';
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

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    localStorage.setItem('wf-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
    return () => controller.abort();
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
      <StickyHeader title="Profile" />

      <div className="px-4 pb-24">
        {/* Member Info */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up">
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
            <div>
              <h2 className="text-lg font-semibold text-white">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : (user?.email || user?.phone || 'User')}
              </h2>
              {user?.firstName && (
                <p className="text-wf-gray-500 text-xs">{user?.email || user?.phone}</p>
              )}
              <p className="text-wf-gray-400 text-sm">REPLAB Member</p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 border-t border-white/10 pt-4">
            {user?.username && (
              <div className="flex justify-between items-center">
                <span className="text-wf-gray-400 text-sm">Username</span>
                <span className="text-white text-sm">@{user.username}</span>
              </div>
            )}
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
              <span className="text-white text-sm">REPLAB</span>
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
            <button
              onClick={() => navigate('/test')}
              className="w-full mt-2 glass-card text-wf-gray-400 text-sm font-medium py-2.5 rounded-xl transition-all active:scale-[0.98] hover:text-white"
            >
              Test
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="glass-card rounded-xl p-6 mb-4 fade-slide-up">
          <button
            onClick={() => { setShowChangePassword(!showChangePassword); setPasswordError(''); setPasswordChanged(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <h3 className="text-base font-semibold text-white">Change Password</h3>
            </div>
            <svg className={`w-5 h-5 text-wf-gray-400 transition-transform ${showChangePassword ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showChangePassword && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
              {passwordError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
                  {passwordError}
                </div>
              )}
              {passwordChanged && (
                <div className="bg-green-900/30 border border-green-800 rounded-lg px-4 py-3 text-green-300 text-sm">
                  Password changed successfully!
                </div>
              )}
              <div>
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
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
                    // Server bumps tokenVersion on password change; new JWT keeps
                    // this session signed in while other sessions are kicked out.
                    if (resp?.token) setApiToken(resp.token);
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
                className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {passwordSaving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full glass-card !border-red-800/50 hover:!border-red-700 text-wf-red font-semibold py-4 rounded-xl text-base transition-all active:scale-[0.98] mb-4 fade-slide-up"
          style={{ animationDelay: '360ms' }}
        >
          Sign Out
        </button>

        {/* Export Data & Delete Account */}
        <div className="flex justify-center gap-4 mb-4 fade-slide-up" style={{ animationDelay: '400ms' }}>
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('replab_token');
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
