import { useEffect, useState } from 'react';
import { Outlet, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import Tutorial from './Tutorial';
import InstallPrompt from './InstallPrompt';
import { useTutorial } from '../context/TutorialContext';
import { useAuth } from '../context/AuthContext';
import { MiniPlayer, useVideoPlayer } from '../context/VideoPlayerContext';

// Layout normally renders the matched child route via &lt;Outlet /&gt;. Accepting
// an optional `children` prop lets a non-route consumer (e.g. the conditional
// HomeRoute in App.jsx) wrap a component in the chrome without nesting under
// a Route. When `children` is provided we render them instead of the Outlet.
export default function Layout({ children }) {
  const { tutorial } = useTutorial();
  const { user } = useAuth();
  const { video, minimized } = useVideoPlayer();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isDashboardEmbed = searchParams.get('from') === 'trainer' || searchParams.get('from') === 'admin';
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const theme = localStorage.getItem('wf-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'synced'

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      // Trigger sync queue processing
      if (navigator.serviceWorker?.controller) {
        setSyncStatus('syncing');
        navigator.serviceWorker.controller.postMessage('process-sync-queue');
        // Also try Background Sync API
        navigator.serviceWorker.ready.then((reg) => {
          reg.sync?.register('replab-sync').catch(() => {});
        });
      }
    };
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Listen for sync completion from service worker
    const handleSWMessage = (event) => {
      if (event.data?.type === 'sync-complete') {
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus(null), 3000);
      }
      if (event.data?.type === 'queued-offline') {
        setOffline(true);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <div className="ambient-bg" />
      {/* Top bar with logo + profile avatar — hidden when embedded from dashboard */}
      {!isDashboardEmbed && (
        <div
          className="relative z-20 px-4 flex items-center justify-between"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.3rem)',
            paddingBottom: '0.05rem',
          }}
        >
          <div className="flex items-center gap-2">
            <img src="/replab-logo.png" alt="REPLAB" className="h-8 w-8 rounded" />
            <span className="text-base font-black tracking-widest">
              REP<span className="text-wf-red">LAB</span>
            </span>
          </div>
          <button
            onClick={() => navigate('/profile')}
            aria-label="Open profile"
            className="w-8 h-8 rounded-full overflow-hidden shrink-0 active:scale-90 transition-transform"
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-wf-red/20 flex items-center justify-center">
                <span className="text-sm font-bold text-wf-red">
                  {(user?.firstName || user?.email || user?.phone || 'U')[0].toUpperCase()}
                </span>
              </div>
            )}
          </button>
        </div>
      )}
      {offline && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-2 z-30 relative">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-xs text-yellow-400 font-medium">You're offline — changes will sync when you reconnect</span>
        </div>
      )}
      {syncStatus === 'syncing' && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center justify-center gap-2 z-30 relative">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-blue-400 font-medium">Syncing offline changes...</span>
        </div>
      )}
      {syncStatus === 'synced' && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2 flex items-center justify-center gap-2 z-30 relative">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-400 font-medium">All changes synced</span>
        </div>
      )}
      <main
        className={`grow shrink-0 basis-auto relative z-10 ${isDashboardEmbed ? 'pb-4' : ''}`}
        style={
          !isDashboardEmbed
            ? {
                // Expanded player: video height (16:9 of viewport, capped at
                // 480px wide) + 48px chrome + nav clearance (see index.css
                // --rl-nav-clearance). Minimized pill floats and doesn't push
                // content, so only the standard nav clearance is needed.
                paddingBottom:
                  video && !minimized
                    ? 'calc(min(100vw, 480px) * 0.5625 + 72px + var(--rl-nav-clearance))'
                    : 'var(--rl-nav-clearance)',
              }
            : undefined
        }
      >
        <div className="page-fade-in" key={location.pathname}>
          {children ?? <Outlet />}
        </div>
      </main>
      {!isDashboardEmbed && <BottomNav />}
      {!isDashboardEmbed && <MiniPlayer />}
      {tutorial.active && <Tutorial />}
      {!isDashboardEmbed && !tutorial.active && <InstallPrompt />}
    </div>
  );
}
