import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import YouTubeEmbed from '../components/YouTubeEmbed.jsx';

const VideoPlayerContext = createContext(null);

export function VideoPlayerProvider({ children }) {
  const [video, setVideo] = useState(null); // { videoId, title, creator } | null
  const [minimized, setMinimized] = useState(false);

  const play     = useCallback((v) => { setVideo(v); setMinimized(false); }, []);
  const close    = useCallback(() => { setVideo(null); setMinimized(false); }, []);
  const minimize = useCallback(() => setMinimized(true), []);
  const expand   = useCallback(() => setMinimized(false), []);

  return (
    <VideoPlayerContext.Provider value={{ video, minimized, play, close, minimize, expand }}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer() {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) throw new Error('useVideoPlayer must be used within VideoPlayerProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// MiniPlayer — single iframe, two layouts (expanded / minimized pill).
// Iframe is never unmounted, so audio/video playback survives mode switches.
// ---------------------------------------------------------------------------

const DRAG_DISMISS_THRESHOLD = 80;

export function MiniPlayer() {
  const { video, close, minimized, expand, minimize } = useVideoPlayer();
  const location = useLocation();
  const [loaded, setLoaded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(null);
  const lastVideoId = useRef(null);

  // Reset loading overlay whenever the video ID changes so the cross-fade
  // triggers on each new video.
  useEffect(() => {
    if (video && lastVideoId.current !== video.videoId) {
      setLoaded(false);
      lastVideoId.current = video.videoId;
    }
    if (!video) lastVideoId.current = null;
  }, [video]);

  // Auto-minimize when the user enters a workout session so the player
  // doesn't sit on top of the timer / sets UI.
  useEffect(() => {
    if (location.pathname.startsWith('/session/')) minimize();
  }, [location.pathname, minimize]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setDragY(0);
  };
  const handleTouchMove = (e) => {
    if (touchStartY.current == null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > DRAG_DISMISS_THRESHOLD) {
      setDragY(600);                       // animate off-screen
      setTimeout(() => close(), 220);      // then unmount
    } else {
      setDragY(0);
    }
    touchStartY.current = null;
  };

  if (!video) return null;

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  const dragging = touchStartY.current != null;
  const dismissProgress = minimized ? dragY / 150 : dragY / 260;
  const opacity = Math.max(0, 1 - dismissProgress);

  // Layout differs between expanded (full width, above nav) and minimized
  // (small pill in bottom-right, floats over content).
  const containerStyle = minimized
    ? {
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
        right: 12,
        width: 200,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        transform: `translateY(${dragY}px)`,
        opacity,
        transition: dragging ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
      }
    : {
        left: 0,
        right: 0,
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 480,
        marginLeft: 'auto',
        marginRight: 'auto',
        background: '#000',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        transform: `translateY(${dragY}px)`,
        opacity,
        transition: dragging ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
      };

  return (
    <div className="fixed z-40" style={containerStyle}>
      {/* Iframe host — the one element that must stay in the DOM across modes */}
      <div
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ aspectRatio: '16 / 9' }}
      >
        <div
          key={video.videoId}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        >
          <YouTubeEmbed
            videoId={video.videoId}
            title={video.title}
            className="absolute inset-0 w-full h-full"
            autoplay={true}
            onReady={() => setLoaded(true)}
          />
        </div>

        {/* Loading spinner — covers the iframe until onLoad fires */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#fff' }}
            />
          </div>
        )}

        {/* Minimized: transparent click-catcher to expand + corner close button.
            Cross-origin iframes capture clicks, so we need our own overlay. */}
        {minimized && (
          <>
            <button
              type="button"
              onClick={expand}
              aria-label="Expand player"
              className="absolute inset-0 w-full h-full"
              style={{ background: 'transparent' }}
            />
            <div
              className="absolute bottom-1 left-1 px-1 py-0.5 rounded-sm pointer-events-none flex items-center gap-0.5"
              style={{ background: 'rgba(0,0,0,0.65)' }}
            >
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              </svg>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); close(); }}
              aria-label="Close player"
              className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Expanded chrome — title + controls */}
      {!minimized && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: '#0a0a0a' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] uppercase font-light truncate"
              style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.2em' }}
            >
              {video.creator}
            </p>
            <p className="text-[12px] font-bold text-white truncate">{video.title}</p>
          </div>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on YouTube"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
          <button
            type="button"
            onClick={minimize}
            aria-label="Minimize player"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close player"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
