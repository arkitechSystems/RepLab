import { createContext, useContext, useState, useCallback } from 'react';

const VideoPlayerContext = createContext(null);

export function VideoPlayerProvider({ children }) {
  const [video, setVideo] = useState(null); // { videoId, title, creator } | null

  const play  = useCallback((v) => setVideo(v), []);
  const close = useCallback(() => setVideo(null), []);

  return (
    <VideoPlayerContext.Provider value={{ video, play, close }}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer() {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) throw new Error('useVideoPlayer must be used within VideoPlayerProvider');
  return ctx;
}

// Fixed mini-player — sits above BottomNav (h-16 + safe-area), below its z-index.
// Iframe stays mounted as long as `video` is set, so playback survives route changes.
export function MiniPlayer() {
  const { video, close } = useVideoPlayer();
  if (!video) return null;

  const src = `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div
      className="fixed left-0 right-0 mx-auto z-40"
      style={{
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 480,
        background: '#000',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={src}
          title={video.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center gap-3 px-3 py-2" style={{ background: '#0a0a0a' }}>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] uppercase font-light truncate"
            style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.2em' }}
          >
            {video.creator}
          </p>
          <p className="text-[12px] font-bold text-white truncate">{video.title}</p>
        </div>
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
    </div>
  );
}
