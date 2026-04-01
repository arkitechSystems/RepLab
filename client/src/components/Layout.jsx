import { useEffect, useState } from 'react';
import { Outlet, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import Tutorial from './Tutorial';
import { useTutorial } from '../context/TutorialContext';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { tutorial } = useTutorial();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isDashboardEmbed = searchParams.get('from') === 'trainer' || searchParams.get('from') === 'admin';
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const theme = localStorage.getItem('wf-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <div className="ambient-bg" />
      {/* Top bar with logo + profile avatar — hidden when embedded from dashboard */}
      {!isDashboardEmbed && (
        <div className="safe-top relative z-20 px-4 pt-4 pb-1 flex items-center justify-between">
          <img src="/RepLabLogo3.jpg" alt="RepLab" className="h-7 rounded" />
          <button
            onClick={() => navigate('/profile')}
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
      <main className={`grow shrink-0 basis-auto relative z-10 ${isDashboardEmbed ? 'pb-4' : 'pb-24'}`}>
        <div className="page-fade-in" key={location.pathname}>
          <Outlet />
        </div>
      </main>
      {!isDashboardEmbed && <BottomNav />}
      {tutorial.active && <Tutorial />}
    </div>
  );
}
