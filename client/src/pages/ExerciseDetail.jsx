import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { getExerciseBySlug, findMasterExerciseBySlug, buildMinimalExercise } from '../data/exercises/index.js';
import { compareExerciseNames, exerciseDetailUrl } from '../utils/exerciseOrder';
import { useExercises, setExerciseFavorite } from '../hooks/useExercises';
import { useToast } from '../context/ToastContext';
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
  // When true, the hero swaps the YouTube thumbnail for an embedded
  // playing iframe in-place. Tap × on the iframe (or navigate to a
  // different slug) returns to the thumbnail view.
  const [videoPlaying, setVideoPlaying] = useState(false);
  // Master library for the fallback path — when the slug isn't in the
  // hand-authored static registry, we build a minimal exercise from the
  // matching master library row so every library entry still renders a
  // working detail page (sections collapse cleanly when data is missing).
  const { exercises: masterExercises } = useExercises();
  const showToast = useToast();
  const [favBusy, setFavBusy] = useState(false);

  // Reset scroll to the top whenever the user lands on a new exercise.
  // Tapping a library row navigates here via react-router which doesn't
  // reset window.scrollY by default — without this, deep-scrolling a card
  // then tapping a different exercise would land the user mid-page on the
  // new detail. The effect also fires when the user navigates between
  // exercises directly (e.g. from a future "related exercise" link) so
  // each detail view starts from the hero. Also dismiss any in-place
  // playing video so the new exercise's thumbnail shows on arrival —
  // unless the ‹ › arrows were tapped mid-video (state.autoplay), in which
  // case the new exercise's video starts right away.
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    setVideoPlaying(!!location.state?.autoplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The library row (id + isFavorite) behind this page, for the bookmark.
  // Static-only exercises with no DB row get no bookmark.
  const libRow = useMemo(
    () => (masterExercises ? findMasterExerciseBySlug(slug, masterExercises) : null),
    [slug, masterExercises]
  );
  const isFavorite = !!libRow?.isFavorite;

  // ‹ › arrows: step through the list the user came from (the Library passes
  // its current filtered, alphabetical list in location.state.navList). A
  // direct link falls back to the whole visible library in the same order.
  const navList = useMemo(() => {
    if (Array.isArray(location.state?.navList)) return location.state.navList;
    return (masterExercises || [])
      .filter((e) => !e.isCustom && !e.hiddenFromLibrary)
      .map((e) => e.name)
      .sort(compareExerciseNames)
      .map(exerciseDetailUrl);
  }, [location.state, masterExercises]);
  const navIdx = navList.indexOf(decodeURIComponent(location.pathname));
  const prevUrl = navIdx > 0 ? navList[navIdx - 1] : null;
  const nextUrl = navIdx >= 0 && navIdx < navList.length - 1 ? navList[navIdx + 1] : null;
  // replace: paging through 30 exercises shouldn't stack 30 history
  // entries — Back still returns straight to the Library. If a video is
  // playing, the next exercise opens with its video playing too, so an
  // audit can go video → video.
  const goTo = (url) => navigate(url, { replace: true, state: { navList, autoplay: videoPlaying } });

  // ‹ › previous / next exercise — vertically centered on the hero edges.
  // No ‹ on the first exercise, no › on the last.
  const arrowStyle = { ...iconCircle, position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10 };
  const navArrows = (
    <>
      {prevUrl && (
        <button onClick={() => goTo(prevUrl)} aria-label="Previous exercise" style={{ ...arrowStyle, left: 12 }} className="active:scale-90 transition-transform">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      {nextUrl && (
        <button onClick={() => goTo(nextUrl)} aria-label="Next exercise" style={{ ...arrowStyle, right: 12 }} className="active:scale-90 transition-transform">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </>
  );

  // Optimistic save/unsave — setExerciseFavorite flips the shared cache
  // (Library Saved filter, picker Saved section) and rolls back on failure.
  async function toggleFavorite() {
    if (!libRow || favBusy) return;
    setFavBusy(true);
    try {
      await setExerciseFavorite(libRow.id, !isFavorite);
    } catch (err) {
      showToast(err?.message || 'Could not update saved exercises. Please try again.', 'error');
    } finally {
      setFavBusy(false);
    }
  }

  if (!exercise) {
    return (
      <div style={{ background: '#0c0c0b', minHeight: '100vh', color: '#fff' }} className="px-4 pt-6">
        <button onClick={() => navigate(-1)} className="text-sm text-white/50 mb-6">← Back</button>
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.4em', color: RED, textTransform: 'uppercase' }}>Not Found</p>
        <p className="text-white/50 text-sm mt-2">Exercise not found</p>
      </div>
    );
  }

  // A videoId starting with "http"/"/" is a direct CDN-hosted file (e.g.
  // replab-videos.onrender.com), not a YouTube ID — same convention as
  // ExerciseCard.jsx. There's no YouTube thumbnail to fetch for those.
  const isCdnVideo = !!exercise.videoId && (exercise.videoId.startsWith('http') || exercise.videoId.startsWith('/'));
  const heroImg = exercise.videoId && !isCdnVideo
    ? `https://img.youtube.com/vi/${exercise.videoId}/maxresdefault.jpg`
    : null;
  const isYouTube = !!exercise.videoId && !isCdnVideo;
  const youTubeWatchUrl = isYouTube ? `https://www.youtube.com/watch?v=${exercise.videoId}` : null;
  // In the native app YouTube goes through our /yt-embed shim on the real
  // domain (the WebView's capacitor://localhost origin gets YouTube error
  // 153 when embedding directly — see server/index.js). The web app already
  // has a real origin, so it embeds YouTube directly.
  const youTubeEmbedUrl = isYouTube
    ? (Capacitor.isNativePlatform()
        ? `https://replab-fitness.com/yt-embed/${exercise.videoId}`
        : `https://www.youtube-nocookie.com/embed/${exercise.videoId}?playsinline=1&autoplay=1&rel=0&modestbranding=1`)
    : null;
  const openVideo = () => {
    // CDN-hosted and YouTube videos both play inline by toggling
    // videoPlaying — the hero swaps from the thumbnail to the player in the
    // same 300px slot. No videoId at all falls back to a YouTube search.
    if (exercise.videoId) {
      setVideoPlaying(true);
    } else {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.name + ' form')}`;
      window.open(url, '_blank');
    }
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
          {videoPlaying && isYouTube ? (
            /* YouTube form video, inline in the hero slot. Close (×)
               returns to the thumbnail; "Open in YouTube" is the escape
               hatch if a video still refuses to embed. */
            <>
              <iframe
                src={youTubeEmbedUrl}
                title={`${exercise.name} form video`}
                style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#000' }}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
                <button onClick={() => navigate(-1)} aria-label="Back" style={{ ...iconCircle, pointerEvents: 'auto' }} className="active:scale-90 transition-transform">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => setVideoPlaying(false)} aria-label="Close video" style={{ ...iconCircle, pointerEvents: 'auto' }} className="active:scale-90 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <button
                onClick={() => window.open(youTubeWatchUrl, '_blank')}
                style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 10, padding: '6px 12px', borderRadius: 100, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}
                className="active:scale-95 transition-transform"
              >
                Open in YouTube
              </button>
              {navArrows}
            </>
          ) : videoPlaying && isCdnVideo ? (
            /* CDN-hosted form video — fills the same 300px hero slot.
               Close button (×) returns to the thumbnail view; back
               button still navigates out. */
            <>
              <video
                src={exercise.videoId}
                title={`${exercise.name} form video`}
                width="100%"
                height="100%"
                style={{ width: '100%', height: '100%', maxWidth: '100%', objectFit: 'cover', display: 'block' }}
                autoPlay
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
              />
              <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
                <button onClick={() => navigate(-1)} aria-label="Back" style={{ ...iconCircle, pointerEvents: 'auto' }} className="active:scale-90 transition-transform">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => setVideoPlaying(false)} aria-label="Close video" style={{ ...iconCircle, pointerEvents: 'auto' }} className="active:scale-90 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </>
          ) : (
            <>
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
                  {libRow && (
                    <button
                      onClick={toggleFavorite}
                      aria-label={isFavorite ? 'Remove from saved' : 'Save exercise'}
                      aria-pressed={isFavorite}
                      style={iconCircle}
                      className="active:scale-90 transition-transform"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? '#fff' : 'none'} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {navArrows}

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
            </>
          )}
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
