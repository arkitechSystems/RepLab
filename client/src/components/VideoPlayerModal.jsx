import { useEffect, useRef } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';

// Loads the YouTube IFrame Player API script exactly once, reusing any
// window.onYouTubeIframeAPIReady callback another instance already set up.
let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => reject(new Error('Failed to load YouTube IFrame API script'));
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

export default function VideoPlayerModal({ videoId, exerciseName, onClose }) {
  const trapRef = useFocusTrap(true);
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // TEMPORARY diagnostic — a bare <iframe src="youtube..."> gives no way to
  // see why an embed fails: no JS callback fires for content-level errors
  // (e.g. YouTube's own "Video player configuration error" card) inside a
  // cross-origin iframe. Switching to the postMessage-based IFrame Player
  // API gives a real onError callback with YouTube's numeric error code
  // (2 = bad parameter, 5 = HTML5 player error, 100 = video not found,
  // 101/150 = embedding blocked by the video owner), surfaced via a native
  // alert() so a TestFlight tester with no console can screenshot it.
  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (e) => {
              const iframe = e.target.getIframe && e.target.getIframe();
              if (iframe) {
                iframe.className = 'absolute inset-0 w-full h-full';
              }
            },
            onError: (e) => {
              window.alert(
                `YouTube player error\ncode: ${e.data}\nvideoId: ${videoId}\norigin: ${window.location.origin}`
              );
            },
          },
        });
      })
      .catch((err) => {
        window.alert(`YouTube API failed to load\n${err.name}: ${err.message}\norigin: ${window.location.origin}`);
      });

    return () => {
      cancelled = true;
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vpm-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal content */}
      <div
        ref={trapRef}
        className="relative w-full max-w-lg mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 id="vpm-title" className="text-white font-semibold text-sm truncate pr-4">{exerciseName}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video player - 16:9 aspect ratio */}
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>
      </div>
    </div>
  );
}
