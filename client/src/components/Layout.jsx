import { useEffect, useState } from 'react';
import { Outlet, useSearchParams, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import Tutorial from './Tutorial';
import { useTutorial } from '../context/TutorialContext';

export default function Layout() {
  const { tutorial } = useTutorial();
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
      {/* Top bar with logo — hidden when embedded from dashboard */}
      {!isDashboardEmbed && (
        <div className="safe-top relative z-20 px-4 pt-3 pb-1">
          <img src="/RepLabLogo3.jpg" alt="RepLab" className="h-7 rounded" />
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
