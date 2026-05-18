import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { api, setApiToken, setAuthTokens, getApiToken } from '../api';
import StickyHeader from '../components/StickyHeader';
import SplashScreen from '../components/SplashScreen';
import { APP_VERSION } from '../version';
import { getWorkoutColor } from '../utils/workoutColors';

// Touch-reactive ticker for the Personal Records strip. Scrolls left at a
// steady speed; while a finger is down it freezes and the user can drag the
// strip left/right to read it. On release we pause for 1s, then ramp the
// scroll speed from 0 back to full over the next 2s so the resume feels
// gentle rather than snapping back into motion.
//
// Driven entirely by requestAnimationFrame + transform — no React state in
// the hot path, so it doesn't re-render every frame.
function PRTicker({ items }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const posRef = useRef(0);            // current translateX in px (negative = scrolled left)
  const pausedRef = useRef(false);     // true while finger is down
  const rampStartRef = useRef(0);      // timestamp when speed ramp began (0 = at full speed)
  const lastFrameRef = useRef(0);      // last rAF timestamp
  const halfWidthRef = useRef(0);      // width of one copy of `items` (track has two)
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const resumeTimerRef = useRef(null);

  const SPEED = 50;          // px/sec — full scroll speed
  const PAUSE_AFTER_MS = 1000; // wait this long after release before ramping
  const RAMP_MS = 2000;        // ramp from 0 to full over this period

  // Measure one copy's width whenever items change so the wrap-around point
  // is right after layout.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    halfWidthRef.current = track.scrollWidth / 2;
  }, [items]);

  useEffect(() => {
    let raf;
    const tick = (now) => {
      const last = lastFrameRef.current || now;
      const dt = (now - last) / 1000;
      lastFrameRef.current = now;

      if (!pausedRef.current && halfWidthRef.current > 0) {
        let speedFactor = 1;
        if (rampStartRef.current) {
          const elapsed = now - rampStartRef.current;
          if (elapsed >= RAMP_MS) {
            rampStartRef.current = 0;
            speedFactor = 1;
          } else {
            // ease-out: starts slow, accelerates smoothly
            const t = elapsed / RAMP_MS;
            speedFactor = t * t;
          }
        }
        posRef.current -= SPEED * speedFactor * dt;
        // Wrap: when we've scrolled one full copy off the left, jump forward
        // by one copy so the second copy seamlessly takes the lead.
        if (posRef.current <= -halfWidthRef.current) {
          posRef.current += halfWidthRef.current;
        }
      }

      const track = trackRef.current;
      if (track) track.style.transform = `translateX(${posRef.current}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e) => {
    pausedRef.current = true;
    rampStartRef.current = 0; // cancel any in-progress ramp
    dragStartXRef.current = e.clientX;
    dragStartPosRef.current = posRef.current;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!pausedRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    let next = dragStartPosRef.current + dx;
    // Keep position within one half-width window so the seamless loop holds
    // even after big drags.
    const half = halfWidthRef.current || 1;
    while (next <= -half) next += half;
    while (next > 0) next -= half;
    posRef.current = next;
    const track = trackRef.current;
    if (track) track.style.transform = `translateX(${posRef.current}px)`;
  };

  const onPointerUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Hold position for PAUSE_AFTER_MS, then begin the speed ramp.
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
      rampStartRef.current = performance.now();
      resumeTimerRef.current = null;
    }, PAUSE_AFTER_MS);
  };

  return (
    <div
      ref={containerRef}
      style={{ overflow: 'hidden', whiteSpace: 'nowrap', touchAction: 'pan-y', cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={trackRef}
        style={{ display: 'inline-block', fontSize: '12px', willChange: 'transform' }}
      >
        {[...items, ...items].map((pr, i) => (
          <span key={i}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{pr.muscle} PR</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
              {` — ${pr.exercise} — ${pr.weight} LBS × ${pr.reps}`}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 16px' }}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Normalize a phone from the stored +1XXXXXXXXXX form (or any 10/11-digit
// variant) to the user-friendly "(XXX) XXX-XXXX". Falls back to the raw
// value for anything that doesn't look like a US 10-digit number.
function formatPhoneDisplay(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function MetricInput({ label, value, unit, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-wf-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          aria-label={unit ? `${label} (${unit})` : label}
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

// Split height entry: two boxes for feet + inches that combine into a single
// total-inches number (the on-disk format). Local string state lets the user
// blank a box while editing without us forcing it back to "0".
function HeightInput({ label, value, onChange }) {
  const totalInches = value ?? null;
  const derivedFeet = totalInches != null ? Math.floor(totalInches / 12) : '';
  const derivedInches = totalInches != null ? totalInches % 12 : '';
  const [feetStr, setFeetStr] = useState(String(derivedFeet));
  const [inchesStr, setInchesStr] = useState(String(derivedInches));

  // Sync local state when the parent value changes (e.g., metrics fetched
  // from the server after first render).
  useEffect(() => {
    setFeetStr(totalInches != null ? String(Math.floor(totalInches / 12)) : '');
    setInchesStr(totalInches != null ? String(totalInches % 12) : '');
  }, [totalInches]);

  const commit = (nextFeetStr, nextInchesStr) => {
    if (nextFeetStr === '' && nextInchesStr === '') {
      onChange(null);
      return;
    }
    const f = Number(nextFeetStr) || 0;
    const i = Number(nextInchesStr) || 0;
    onChange(f * 12 + i);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-wf-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="9"
          aria-label={`${label} feet`}
          value={feetStr}
          onChange={(e) => { const v = e.target.value; setFeetStr(v); commit(v, inchesStr); }}
          placeholder="—"
          className="w-12 glass-input rounded-lg px-2 py-1.5 text-white text-sm text-right font-medium focus:outline-none transition-all placeholder:text-wf-gray-600"
        />
        <span className="text-wf-gray-500 text-xs">ft</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="11"
          aria-label={`${label} inches`}
          value={inchesStr}
          onChange={(e) => { const v = e.target.value; setInchesStr(v); commit(feetStr, v); }}
          placeholder="—"
          className="w-12 glass-input rounded-lg px-2 py-1.5 text-white text-sm text-right font-medium focus:outline-none transition-all placeholder:text-wf-gray-600"
        />
        <span className="text-wf-gray-500 text-xs">in</span>
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
  const [shareActivityOn, setShareActivityOn] = useState(() => localStorage.getItem('wf-share-activity-to-community') !== 'off');
  // Workout-session defaults — keys shared with WorkoutSession.jsx so the
  // toggle here is the same value the session reads on mount. Any in-session
  // override (lock buttons, gear menu) writes back to the same key.
  const [defaultPinWorkoutTimer, setDefaultPinWorkoutTimer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-pin-workout-timer')) ?? false; } catch { return false; }
  });
  const [defaultPinRestTimer, setDefaultPinRestTimer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-pin-rest-timer')) ?? true; } catch { return true; }
  });
  // Default OFF for new users — keeps the workout view minimal on first run.
  // Users who want goal-weight / goal-reps / set-type columns can opt in
  // here, and that choice persists for subsequent sessions via the same
  // localStorage key WorkoutSession.jsx reads.
  const [defaultShowGoalWeight, setDefaultShowGoalWeight] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-show-goal-weight')) ?? false; } catch { return false; }
  });
  const [defaultShowGoalReps, setDefaultShowGoalReps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-show-goal-reps')) ?? false; } catch { return false; }
  });
  const [defaultShowSetType, setDefaultShowSetType] = useState(() => {
    try { return JSON.parse(localStorage.getItem('replab_show_set_type')) ?? false; } catch { return false; }
  });
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
  // Stats & Streak card moved to /test/brainstorm.
  // Body-part PRs feed the Personal Records ticker (between Member Info and the Alpha banner below).
  const [bodyPartPRs, setBodyPartPRs] = useState([]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    localStorage.setItem('wf-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('wf-bible-verses', bibleVersesOn ? 'on' : 'off');
  }, [bibleVersesOn]);

  useEffect(() => {
    localStorage.setItem('wf-share-activity-to-community', shareActivityOn ? 'on' : 'off');
  }, [shareActivityOn]);

  // Persist workout-session defaults. WorkoutSession.jsx reads these same
  // keys at mount so each new session inherits the latest preference.
  useEffect(() => {
    localStorage.setItem('wf-default-pin-workout-timer', JSON.stringify(defaultPinWorkoutTimer));
  }, [defaultPinWorkoutTimer]);
  useEffect(() => {
    localStorage.setItem('wf-default-pin-rest-timer', JSON.stringify(defaultPinRestTimer));
  }, [defaultPinRestTimer]);
  useEffect(() => {
    localStorage.setItem('wf-default-show-goal-weight', JSON.stringify(defaultShowGoalWeight));
  }, [defaultShowGoalWeight]);
  useEffect(() => {
    localStorage.setItem('wf-default-show-goal-reps', JSON.stringify(defaultShowGoalReps));
  }, [defaultShowGoalReps]);
  useEffect(() => {
    localStorage.setItem('replab_show_set_type', JSON.stringify(defaultShowSetType));
  }, [defaultShowSetType]);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    api('/metrics', opts)
      .then(setMetrics)
      .catch((err) => { if (err.name !== 'AbortError' && import.meta.env.DEV) console.error(err); });

    api('/sessions', opts)
      .then(setSessions)
      .catch((err) => { if (err.name !== 'AbortError' && import.meta.env.DEV) console.error(err); })
      .finally(() => setSessionsLoading(false));
    api('/pbs/by-body-part', opts)
      .then((data) => setBodyPartPRs(Array.isArray(data) ? data : []))
      .catch((err) => { if (err.name !== 'AbortError' && import.meta.env.DEV) console.error(err); });
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
      if (import.meta.env.DEV) console.error(err);
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
      if (import.meta.env.DEV) console.error(err);
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
      if (import.meta.env.DEV) console.error('Failed to upload photo:', err);
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
      if (import.meta.env.DEV) console.error('Failed to remove photo:', err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div className="profile-transparent">
      <h1 className="sr-only">REPLAB Profile</h1>
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
                  REPLAB MEMBER
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
                  <span className="text-white text-[13px] font-medium truncate">{user.username}</span>
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
                  <span className="text-white text-[13px] font-medium truncate">{formatPhoneDisplay(user.phone)}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] uppercase font-semibold text-white/30" style={{ letterSpacing: '0.25em' }}>Account ID</span>
                <span className="text-white/50 text-[13px] font-medium tabular-nums">{user?.accountId ?? user?.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Records ticker — moved here from Workouts page (was above the Tutorial card). */}
        {(() => {
          const items = bodyPartPRs.map((pr) => ({
            muscle: (pr.muscle_group || 'PR').toUpperCase(),
            exercise: pr.exercise_name,
            weight: Number(pr.best_weight),
            reps: pr.best_reps,
          }));
          const hasPRs = items.length > 0;
          return (
            <div
              className="fade-slide-up mb-4"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '2px',
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ padding: '16px', overflow: 'hidden' }}>
                <p
                  className="text-[10px] uppercase font-light mb-2"
                  style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.25em' }}
                >
                  Personal Records
                </p>
                <div style={{ borderBottom: '1px dotted rgba(255,255,255,0.15)', marginBottom: '12px' }} />
                {hasPRs ? (
                  <PRTicker items={items} />
                ) : (
                  <p
                    style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 300, lineHeight: 1.5 }}
                  >
                    You haven't set any PRs yet. Start your first workout to set some PRs!!
                  </p>
                )}
              </div>
            </div>
          );
        })()}

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
              <p className="text-xs text-wf-gray-400 mt-0.5 leading-relaxed">We are constantly improving the app. Send us any improvements or new features you would like to see in the app to help you reach your fitness goals.</p>
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

        {/* Stats & Streak card moved to /test/brainstorm. */}

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
            <div className="space-y-4">
              {/* Workout-session defaults — set the initial state of timers
                  and goal columns when a session opens. The user can still
                  flip each one inside the session via the lock icons / gear. */}
              <div className="pt-3 border-t border-white/10 -mx-6 px-6 space-y-4">
                <p className="text-[10px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
                  Workout Session Defaults
                </p>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Workout Timer Locked</span>
                  </div>
                  <button
                    onClick={() => setDefaultPinWorkoutTimer(!defaultPinWorkoutTimer)}
                    aria-label={defaultPinWorkoutTimer ? 'Default to unlocked workout timer' : 'Default to locked workout timer'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${defaultPinWorkoutTimer ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${defaultPinWorkoutTimer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M12 7v5l3 3" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Rest Timer Locked</span>
                  </div>
                  <button
                    onClick={() => setDefaultPinRestTimer(!defaultPinRestTimer)}
                    aria-label={defaultPinRestTimer ? 'Default to unlocked rest timer' : 'Default to locked rest timer'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${defaultPinRestTimer ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${defaultPinRestTimer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z M7 12h2m6 0h2" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Show Goal Weight</span>
                  </div>
                  <button
                    onClick={() => setDefaultShowGoalWeight(!defaultShowGoalWeight)}
                    aria-label={defaultShowGoalWeight ? 'Hide goal weight by default' : 'Show goal weight by default'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${defaultShowGoalWeight ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${defaultShowGoalWeight ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h.01M7 12h.01M11 12h.01M15 12h.01M19 12h.01" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Show Goal Reps</span>
                  </div>
                  <button
                    onClick={() => setDefaultShowGoalReps(!defaultShowGoalReps)}
                    aria-label={defaultShowGoalReps ? 'Hide goal reps by default' : 'Show goal reps by default'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${defaultShowGoalReps ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${defaultShowGoalReps ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Show Set Type</span>
                  </div>
                  <button
                    onClick={() => setDefaultShowSetType(!defaultShowSetType)}
                    aria-label={defaultShowSetType ? 'Hide set type by default' : 'Show set type by default'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${defaultShowSetType ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${defaultShowSetType ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Other settings — non-session preferences (Bible verses,
                  future misc toggles). Same wrapper pattern as Workout
                  Session Defaults so the divider extends to the card edges. */}
              <div className="pt-3 border-t border-white/10 -mx-6 px-6 space-y-4">
                <p className="text-[10px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
                  Other Settings
                </p>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Share activity to community</span>
                  </div>
                  <button
                    onClick={() => setShareActivityOn(!shareActivityOn)}
                    aria-label={shareActivityOn ? 'Stop sharing activity to community' : 'Share activity to community'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${shareActivityOn ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${shareActivityOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-px">
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <svg className="w-4 h-4 text-wf-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Bible Verses</span>
                  </div>
                  <button
                    onClick={() => setBibleVersesOn(!bibleVersesOn)}
                    aria-label={bibleVersesOn ? 'Turn off Bible verses' : 'Turn on Bible verses'}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${bibleVersesOn ? 'bg-wf-red' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${bibleVersesOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

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
              <HeightInput label="Height" value={metrics.height} onChange={(v) => updateMetric('height', v)} />
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
                        onClick={() => navigate(`/summary/${session.id}`)}
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
                  <label htmlFor="profile-current-password" className="text-[10px] text-white/40 uppercase mb-1.5 block font-semibold" style={{ letterSpacing: '0.25em' }}>Current Password</label>
                  <input
                    id="profile-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="profile-new-password" className="text-[10px] text-white/40 uppercase mb-1.5 block font-semibold" style={{ letterSpacing: '0.25em' }}>New Password</label>
                  <input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="w-full px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-all"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="profile-confirm-new-password" className="text-[10px] text-white/40 uppercase mb-1.5 block font-semibold" style={{ letterSpacing: '0.25em' }}>Confirm New Password</label>
                  <input
                    id="profile-confirm-new-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
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
                  <label htmlFor="profile-delete-password" className="text-xs text-wf-gray-500 mb-1 block">Enter your password</label>
                  <input
                    id="profile-delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    className="w-full glass-input rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-wf-gray-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="profile-delete-confirm" className="text-xs text-wf-gray-500 mb-1 block">Type <span className="text-red-400 font-semibold">DELETE</span> to confirm</label>
                  <input
                    id="profile-delete-confirm"
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
