import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExerciseBySlug, findMasterExerciseBySlug, buildMinimalExercise } from '../data/exercises/index.js';
import { useExercises } from '../hooks/useExercises';
import ExerciseDetailCard from '../components/ExerciseDetailCard.jsx';

const RED = '#ef4444';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const iconCircle = {
  width: 40, height: 40, borderRadius: '50%', padding: 0, flexShrink: 0,
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

export default function ExerciseDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  // Master library for the fallback path — when the slug isn't in the
  // hand-authored static registry, we build a minimal exercise from the
  // matching master library row so every library entry still renders a
  // working detail page (sections collapse cleanly when data is missing).
  const { exercises: masterExercises } = useExercises();

  // Reset scroll to the top whenever the user lands on a new exercise.
  // Tapping a library row navigates here via react-router which doesn't
  // reset window.scrollY by default — without this, deep-scrolling a card
  // then tapping a different exercise would land the user mid-page on the
  // new detail. The effect also fires when the user navigates between
  // exercises directly (e.g. from a future "related exercise" link) so
  // each detail view starts from the hero.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Resolve the exercise from static first, then master library fallback.
  // If a static file exists but lacks a videoId, merge in the master
  // library's video_id so the hero thumbnail still works.
  const exercise = useMemo(() => {
    const staticEx = getExerciseBySlug(slug);
    if (staticEx) {
      if (!staticEx.videoId && masterExercises) {
        const libRow = findMasterExerciseBySlug(slug, masterExercises);
        if (libRow?.videoId) return { ...staticEx, videoId: libRow.videoId };
      }
      return staticEx;
    }
    if (masterExercises) {
      const libRow = findMasterExerciseBySlug(slug, masterExercises);
      if (libRow) return buildMinimalExercise(libRow);
    }
    return null;
  }, [slug, masterExercises]);

  if (!exercise) {
    return (
      <div style={{ background: '#0c0c0b', minHeight: '100vh', color: '#fff' }} className="px-4 pt-6">
        <button onClick={() => navigate(-1)} className="text-sm text-white/50 mb-6">← Back</button>
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.4em', color: RED, textTransform: 'uppercase' }}>Not Found</p>
        <p className="text-white/50 text-sm mt-2">Exercise not found</p>
      </div>
    );
  }

  const heroImg = exercise.videoId
    ? `https://img.youtube.com/vi/${exercise.videoId}/maxresdefault.jpg`
    : null;
  const openVideo = () => {
    const url = exercise.videoId
      ? `https://www.youtube.com/watch?v=${exercise.videoId}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name + ' form')}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ background: '#0c0c0b', minHeight: '100vh', color: '#fff' }} className="pb-28">
      {/* ── HERO ── */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: '100%', height: 300, position: 'relative',
          background: heroImg
            ? `#15130f center/cover no-repeat url(${heroImg})`
            : 'linear-gradient(160deg, #2a2724 0%, #15130f 100%)',
        }}>
          {/* scrim */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,9,0.45) 0%, transparent 30%, rgba(10,10,9,0.96) 100%)' }} />

          {/* back + play + save */}
          <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
            <button onClick={() => navigate(-1)} aria-label="Back" style={iconCircle} className="active:scale-90 transition-transform">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openVideo} aria-label="Watch form video" style={iconCircle} className="active:scale-90 transition-transform">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="6 4 20 12 6 20 6 4" /></svg>
              </button>
              <button aria-label="Save" style={iconCircle} className="active:scale-90 transition-transform">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
              </button>
            </div>
          </div>

          {/* title block */}
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, zIndex: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.32em', color: RED, textTransform: 'uppercase' }}>
              {exercise.category}{exercise.primaryMuscles?.[0] ? ` · ${exercise.primaryMuscles[0]}` : ''}
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: '#fff', margin: '8px 0 0', letterSpacing: '-0.03em', lineHeight: 0.98 }}>
              {exercise.name}
            </h1>
            {/* Single equipment pill — was previously type + difficulty + equipment
                stacked. Per design feedback, just the equipment (Barbell / Dumbbell
                / Cable Machine / Bodyweight etc.) reads cleaner. */}
            {exercise.equipment && (
              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', padding: '5px 9px', borderRadius: 100, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', backdropFilter: 'blur(8px)' }}>{exercise.equipment}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {exercise.description && (
        <div style={{ margin: '20px 16px 12px' }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', margin: 0, textWrap: 'pretty' }}>
            {exercise.description}
          </p>
        </div>
      )}

      {/* ── SECTIONS ── */}
      <ExerciseDetailCard exercise={exercise} />

      {/* secondary muscles footnote */}
      {exercise.secondaryMuscles?.length > 0 && (
        <div style={{ margin: '4px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Also works</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{exercise.secondaryMuscles.join(' · ')}</span>
        </div>
      )}

      {/* ── STICKY ACTION BAR ── */}
      <div style={{ position: 'fixed', left: 14, right: 14, bottom: 14, zIndex: 40, maxWidth: 480, margin: '0 auto', borderRadius: 16, padding: 8, display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(20,18,16,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 12px 30px rgba(0,0,0,0.6)' }}>
        <button style={{ flex: 1, height: 46, borderRadius: 12, background: RED, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', boxShadow: '0 6px 18px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} className="active:scale-[0.98] transition-transform">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add to Workout
        </button>
        <button style={{ flexShrink: 0, padding: '0 18px', height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }} className="active:scale-95 transition-transform">
          Log Set
        </button>
      </div>
    </div>
  );
}
