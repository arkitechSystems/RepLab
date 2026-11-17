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

// Uses the postMessage-based IFrame Player API rather than a bare iframe, so a
// failed embed reports YouTube's numeric error code (2 = bad parameter,
// 5 = HTML5 player error, 100 = video not found, 101/150 = embedding blocked
// by the video owner) to the console. Every YouTube embed in the app goes
// through this one component.
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
              console.warn(`YouTube player error ${e.data} (video ${videoId})`);
            },
          },
        });
      })
      .catch((err) => {
        console.warn(`YouTube API failed to load: ${err.message}`);
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
