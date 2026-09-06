import { useEffect, useRef } from 'react';

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

// TEMPORARY diagnostic — a bare <iframe src="youtube..."> gives no way to
// see why an embed fails: no JS callback fires for content-level errors
// (e.g. YouTube's own "Video player configuration error" card) inside a
// cross-origin iframe. This uses the postMessage-based IFrame Player API
// instead, so onError gives YouTube's real numeric error code (2 = bad
// parameter, 5 = HTML5 player error, 100 = video not found, 101/150 =
// embedding blocked by the video owner), surfaced via alert() so a
// TestFlight tester with no console can screenshot it. Every YouTube
// embed in the app should go through this one component so the
// diagnostic (and later, the real fix) only needs to live in one place.
export default function YouTubeEmbed({ videoId, title, className, autoplay = true, onReady }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);

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
          playerVars: { autoplay: autoplay ? 1 : 0, rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (e) => {
              const iframe = e.target.getIframe && e.target.getIframe();
              if (iframe) {
                iframe.className = 'w-full h-full';
                iframe.style.border = '0';
                if (title) iframe.title = title;
              }
              if (onReady) onReady(e);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, autoplay]);

  return <div ref={containerRef} className={className} />;
}
