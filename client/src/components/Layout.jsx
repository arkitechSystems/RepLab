import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <div className="ambient-bg" />
      <main className="flex-1 pb-20 safe-top relative z-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
