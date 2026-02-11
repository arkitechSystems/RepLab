import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <div className="ambient-bg" />
      {/* Top bar with logo */}
      <div className="safe-top relative z-20 px-4 pt-3 pb-1">
        <span className="text-lg font-black tracking-wide text-white logo-glow">
          W<span className="text-wf-red">F</span>
        </span>
      </div>
      <main className="flex-1 pb-20 relative z-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
