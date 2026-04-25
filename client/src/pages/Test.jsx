import { useNavigate } from 'react-router-dom';

export default function Test() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative">
      {/* Background video */}
      <video
        ref={(el) => {
          if (!el) return;
          el.currentTime = 7;
          el.ontimeupdate = () => {
            if (el.duration && el.currentTime >= el.duration - 6) {
              el.currentTime = 7;
            }
          };
          el.play().catch(() => {});
        }}
        className="fixed inset-0 w-full h-full object-cover z-0 opacity-50"
        autoPlay
        loop
        muted
        playsInline
        webkit-playsinline=""
        preload="auto"
        src="/Gym cinematic promotion video.mp4"
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />

      {/* Page content */}
      <div className="relative z-10 px-4 pt-6 pb-24">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-black text-white mb-6">Test Page</h1>

        <div className="space-y-4">
          <div
            onClick={() => navigate('/test/parallax')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Parallax Animation</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Will's Hypertrophy hero — scroll-driven layered animation, mouse-tilt photo, count-up stats, neon flicker quote</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/brainstorm')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Brainstorm</h2>
              <p className="text-xs text-wf-gray-500 mt-1">26 UI pattern sandbox — buttons, rings, sheets, charts, pickers, heatmaps, confetti</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/bible-verses')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Bible Verses</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Every-7-workout reflection screen — Georgia italic words reveal left-to-right</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/feed')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">RepLab Feed</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Community sandbox — activity feed + fitness news/influencer feed</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/nike-cards')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Nike Cards</h2>
              <p className="text-xs text-wf-gray-500 mt-1">20 reusable Nike-style card examples for use throughout the app</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/new-homepage')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">New Test Homepage</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Homepage redesign sandbox — based on Nike-inspired design</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/nike')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Nike Test Homepage</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Bold typography, full-bleed hero, carousel, counters, pill buttons</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/cards')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Cards. Test.</h2>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/workout-session')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Workout Session. Test.</h2>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/tutorial')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Tutorial Test</h2>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/new-session')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Organic Blob Workout Session</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Chest One · Purple theme sandbox</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/neumorphic-session')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Neumorphic Workout Session</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Chest One · Light neumorphic sandbox</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/test/challenge-section')}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="p-5">
              <h2 className="text-xl font-black text-white tracking-tight">Test Challenge Section</h2>
              <p className="text-xs text-wf-gray-500 mt-1">Segmented control + hero stats + accordion + leaderboard podium</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
