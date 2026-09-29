import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { track } from '../utils/analytics';

// Shared state + handlers for the "It looks like you missed a workout" prompt
// (MissedWorkoutsModal), used by the Workouts page and the Calendar. Server
// side: GET /schedule/missed, POST /schedule/missed/resume|skip
// (server/missedWorkouts.js).
//
//   const missed = useMissedWorkoutsPrompt({ trigger, promptOnLoad, onProceed, onResolved });
//   if (missed.guardStart(templateId, date, opts)) return;  // before starting
//   <MissedWorkoutsModal {...missed.modalProps} />
//
// - promptOnLoad: show the prompt as soon as misses load (Workouts page open).
// - trigger: PostHog `trigger` for prompts raised by guardStart ('start',
//   'calendar'); on-load prompts report 'open'.
// - onProceed(templateId, date, opts): start that workout for real (the
//   caller's own navigation, with its missed check disabled).
// - onResolved(): refresh the page after a Resume from an on-load prompt.
//
// Start-triggered prompts: Resume → the resumed workout on today; Skip or
// close (X / backdrop) → the workout they tapped. Closing leaves the misses
// unresolved, so the next visit or Start tap asks again.

// Local-calendar YYYY-MM-DD (not UTC) — the missed endpoints need the user's
// own "today".
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function useMissedWorkoutsPrompt({ trigger = 'start', promptOnLoad = false, onProceed, onResolved } = {}) {
  const [missed, setMissed] = useState([]);
  // null = closed; { pending: {templateId, date, opts} | null } = open.
  const [prompt, setPrompt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Latest callbacks without re-running the load effect.
  const proceedRef = useRef(onProceed);
  const resolvedRef = useRef(onResolved);
  proceedRef.current = onProceed;
  resolvedRef.current = onResolved;

  // Best-effort load on mount: a failure just means no prompt this time.
  useEffect(() => {
    let cancelled = false;
    api(`/schedule/missed?today=${localDateStr()}`)
      .then((data) => {
        if (cancelled || !data?.missed?.length) return;
        setMissed(data.missed);
        if (promptOnLoad) {
          setPrompt({ pending: null });
          track('missed_workouts_prompt_shown', { count: data.missed.length, trigger: 'open' });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returns true when it intercepted the start to show the prompt.
  function guardStart(templateId, date, opts = {}) {
    if (missed.length === 0) return false;
    setError('');
    setPrompt({ pending: { templateId, date, opts } });
    track('missed_workouts_prompt_shown', { count: missed.length, trigger });
    return true;
  }

  function proceed(templateId, date, opts) {
    if (proceedRef.current) proceedRef.current(templateId, date, opts || {});
  }

  function resolved() {
    setMissed([]);
    setPrompt(null);
  }

  async function onResume() {
    const pending = prompt?.pending;
    const today = localDateStr();
    setBusy(true);
    setError('');
    try {
      const res = await api('/schedule/missed/resume', {
        method: 'POST',
        body: JSON.stringify({ today, fromDate: missed[0].date }),
      });
      track('missed_workouts_resumed', { days: res.days, count: missed.length });
      resolved();
      if (pending) proceed(res.templateId, today, pending.opts);
      else if (resolvedRef.current) resolvedRef.current();
    } catch (err) {
      if (err.status === 409) {
        // Already resolved (double tap / another device) — carry on.
        resolved();
        if (pending) proceed(pending.templateId, pending.date, pending.opts);
        else if (resolvedRef.current) resolvedRef.current();
      } else {
        setError("Couldn't update your schedule. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSkip() {
    const pending = prompt?.pending;
    setBusy(true);
    setError('');
    try {
      await api('/schedule/missed/skip', {
        method: 'POST',
        body: JSON.stringify({ today: localDateStr() }),
      });
      track('missed_workouts_skipped', { count: missed.length });
      resolved();
      if (pending) proceed(pending.templateId, pending.date, pending.opts);
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // X / backdrop: never blocks. A start-triggered prompt continues into the
  // tapped workout; the misses stay unresolved so it asks again next time.
  function onClose() {
    const pending = prompt?.pending;
    setPrompt(null);
    setError('');
    if (pending) proceed(pending.templateId, pending.date, pending.opts);
  }

  return {
    guardStart,
    modalProps: { open: !!prompt, missed, busy, error, onResume, onSkip, onClose },
  };
}
