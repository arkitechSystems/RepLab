import { useEffect, useState } from 'react';
import { Outlet, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import Tutorial from './Tutorial';
import InstallPrompt from './InstallPrompt';
import PushPermissionPrompt from './PushPermissionPrompt';
import { useTutorial } from '../context/TutorialContext';
import { useAuth } from '../context/AuthContext';
import { MiniPlayer, useVideoPlayer } from '../context/VideoPlayerContext';
import { getConnectionState, subscribeConnection, subscribeShowingCached } from '../api';
import { usePendingSaveCount } from '../queries/status';

// "3:42 PM" today, "Oct 5, 3:42 PM" otherwise.
function formatSavedAt(ms) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}
const STALE_LABEL_AFTER_MS = 8000;

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
  // 'ok' | 'slow' | 'failed' — from api.js; drives the slow-connection banner.
  const [connection, setConnection] = useState(getConnectionState);
  // Saves queued by TanStack Query that the server hasn't confirmed yet.
  const pendingSaves = usePendingSaveCount();
  useEffect(() => subscribeConnection(setConnection), []);
  // Screens painted from the saved copy whose refresh hasn't landed yet.
  // The "Showing saved data" line appears once one has waited > 8s.
  const [cachedMarks, setCachedMarks] = useState([]);
  const [, setStaleTick] = useState(0);
  useEffect(() => subscribeShowingCached(setCachedMarks), []);
  useEffect(() => {
    const waits = cachedMarks.map((m) => m.since + STALE_LABEL_AFTER_MS - Date.now()).filter((ms) => ms > 0);
    if (!waits.length) return undefined;
    const t = setTimeout(() => setStaleTick((n) => n + 1), Math.min(...waits) + 20);
    return () => clearTimeout(t);
  }, [cachedMarks]);
  const staleMarks = cachedMarks.filter((m) => Date.now() - m.since >= STALE_LABEL_AFTER_MS);
  const staleSince = staleMarks.length ? Math.min(...staleMarks.map((m) => m.at)) : null;

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
      {/* Skip-to-content link — invisible until focused (Tab from page load).
          Lets keyboard / SR users bypass the logo, profile avatar, and
          offline/sync banner chrome and jump straight to the route content. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] bg-wf-red px-3 py-2 rounded text-white text-sm font-semibold"
      >
        Skip to content
      </a>
      <div className="ambient-bg" />
      {/* Top bar with logo + profile avatar — hidden when embedded from dashboard.
          Always renders on a solid black surface, even on routes that change
          the surrounding page bg (e.g. the workout session's light-cards
          mode swaps the page to #e8e8e8). The explicit background here keeps
          the RepLab logo + avatar pinned to the brand black regardless of
          theme. */}
      {!isDashboardEmbed && (
        <div
          className="relative z-20 px-4 flex items-center justify-between"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.3rem)',
            paddingBottom: '0.05rem',
            background: '#000',
          }}
        >
          {/* RepLab wordmark — matches the landing page nav exactly. Uses
              the landing-logo-mark.png (no rounded corners), w-7 h-7, and
              text-[18px] font-black tracking-widest so the in-app header
              and the marketing surfaces read as one continuous brand. */}
          <div className="flex items-center gap-2.5">
            <img src="/landing-logo-mark.png" alt="RepLab" className="w-7 h-7" />
            <span className="text-[18px] font-black tracking-widest">
              REP<span style={{ color: '#e10600' }}>LAB</span>
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
      <div role="status" aria-live="polite">
        {offline && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-2 z-30 relative">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-xs text-yellow-400 font-medium">You're offline — changes will sync when you reconnect</span>
          </div>
        )}
        {!offline && connection !== 'ok' && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-2 z-30 relative">
            <div className={`w-2 h-2 shrink-0 rounded-full bg-yellow-500${connection === 'slow' ? ' animate-pulse' : ''}`} />
            <span className="text-xs text-yellow-400 font-medium text-center">
              {connection === 'slow'
                ? 'Slow connection — still trying…'
                : "Couldn't reach RepLab — your workout is saved on this phone and will sync when you're back online."}
            </span>
          </div>
        )}
        {pendingSaves > 0 && (
          <div className="px-4 py-1.5 flex items-center justify-center gap-2 z-30 relative" style={{ background: 'rgba(234,179,8,0.06)', borderBottom: '1px solid rgba(234,179,8,0.12)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0" aria-hidden="true"><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
            <span className="text-[11px] text-yellow-400 font-medium">
              {pendingSaves === 1 ? '1 change waiting to sync' : `${pendingSaves} changes waiting to sync`}
            </span>
          </div>
        )}
        {staleSince != null && (
          <div className="px-4 py-1.5 flex items-center justify-center gap-2 z-30 relative" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-wf-gray-400 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <span className="text-[11px] text-wf-gray-400 font-medium">Showing saved data from {formatSavedAt(staleSince)}</span>
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
      </div>
      <main
        id="main"
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
      {!isDashboardEmbed && !tutorial.active && <PushPermissionPrompt />}
    </div>
  );
}
