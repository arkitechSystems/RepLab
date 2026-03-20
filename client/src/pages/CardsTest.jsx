import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CardsTest() {
  const navigate = useNavigate();
  const [toggleOn, setToggleOn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-2">Cards. Test.</h1>
      <p className="text-wf-gray-400 text-sm mb-6">10 card styles for UI exploration</p>

      <div className="space-y-5">

        {/* 1. Hero Card */}
        <div className="rounded-2xl overflow-hidden relative" style={{ minHeight: '180px' }}>
          <video
            ref={(el) => { if (el) { el.currentTime = 7; el.play().catch(() => {}); } }}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay loop muted playsInline src="/Gym cinematic promotion video.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: '180px' }}>
            <div className="mt-auto">
              <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-1">1. Hero Card</p>
              <h2 className="text-xl font-black text-white drop-shadow-lg">Full-Width Background</h2>
              <p className="text-white/60 text-sm mt-1">Video or image with text overlay at the bottom</p>
            </div>
          </div>
        </div>

        {/* 2. Stat Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-3">2. Stat Card</p>
          <div className="flex gap-4">
            <div className="flex-1 text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-wf-red to-orange-400 bg-clip-text text-transparent">247</div>
              <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mt-1">Workouts</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">18</div>
              <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mt-1">Day Streak</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">42</div>
              <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mt-1">PRs</div>
            </div>
          </div>
        </div>

        {/* 3. Action Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold px-5 pt-4 mb-2">3. Action Card</p>
          {[
            { icon: '🏋️', title: 'Start Workout', subtitle: 'Continue where you left off' },
            { icon: '📊', title: 'View Progress', subtitle: 'Check your weekly stats' },
            { icon: '🎯', title: 'Set a Goal', subtitle: 'Target a new personal best' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-t border-white/5 active:bg-white/5 transition-colors cursor-pointer">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="text-xs text-wf-gray-500">{item.subtitle}</p>
              </div>
              <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          ))}
        </div>

        {/* 4. Progress Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-4">4. Progress Card</p>
          <div className="flex items-center gap-5">
            {/* Circular progress ring */}
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="97.4" strokeDashoffset="24.4" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black text-white">75%</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Weekly Goal</h3>
              <p className="text-xs text-wf-gray-400 mt-1">3 of 4 workouts completed</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-wf-red to-orange-400 rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 5. Notification/Banner Card */}
        {!dismissed && (
          <div className="rounded-2xl overflow-hidden border-l-4 border-yellow-500 bg-yellow-500/10">
            <div className="p-4 flex items-start gap-3">
              <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold shrink-0 mt-0.5">5.</p>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-400">Notification / Banner Card</h3>
                <p className="text-xs text-wf-gray-400 mt-1">Colored accent border with a message. Great for alerts, tips, or promotions.</p>
              </div>
              <button onClick={() => setDismissed(true)} className="text-wf-gray-500 active:text-white shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 6. Carousel Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold px-5 pt-4 mb-3">6. Carousel Card</p>
          <div className="flex gap-3 overflow-x-auto px-5 pb-5 snap-x snap-mandatory scrollbar-hide">
            {['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Core'].map((name, i) => (
              <div key={i} className="snap-center shrink-0 w-32 bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer active:scale-95 transition-transform">
                <div className={`w-10 h-10 rounded-full mb-3 flex items-center justify-center text-white text-sm font-bold ${
                  ['bg-wf-red', 'bg-wf-blue', 'bg-wf-green', 'bg-wf-purple', 'bg-wf-orange'][i]
                }`}>{name[0]}</div>
                <h4 className="text-sm font-semibold text-white">{name}</h4>
                <p className="text-[10px] text-wf-gray-500 mt-1">4 exercises</p>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Toggle Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-3">7. Toggle Card</p>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Rest Timer</h3>
              <p className="text-xs text-wf-gray-500 mt-0.5">Auto-start timer between sets</p>
            </div>
            <button
              onClick={() => setToggleOn(!toggleOn)}
              className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${toggleOn ? 'bg-wf-red' : 'bg-white/15'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all duration-200 ${toggleOn ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* 8. Profile/Avatar Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-3">8. Profile / Avatar Card</p>
          <div className="space-y-3">
            {[
              { name: 'Will M.', reps: '52 pushups', rank: 1, color: 'from-yellow-500 to-orange-500' },
              { name: 'Sarah K.', reps: '48 pushups', rank: 2, color: 'from-blue-500 to-purple-500' },
              { name: 'Jake R.', reps: '41 pushups', rank: 3, color: 'from-green-500 to-emerald-500' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                  <p className="text-xs text-wf-gray-500">{p.reps}</p>
                </div>
                <span className={`text-sm font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400'}`}>#{p.rank}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 9. Expandable/Accordion Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full p-5 flex items-center justify-between active:bg-white/5 transition-colors"
          >
            <div className="text-left">
              <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-1">9. Expandable / Accordion Card</p>
              <h3 className="text-base font-bold text-white">Bench Press</h3>
              <p className="text-xs text-wf-gray-500 mt-0.5">3 sets &middot; 200 lbs</p>
            </div>
            <svg
              className={`w-5 h-5 text-wf-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {expanded && (
            <div className="border-t border-white/5 px-5 py-4 space-y-2 bg-white/[0.02]">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center justify-between py-2">
                  <span className="text-xs text-wf-gray-500 font-bold">Set {s}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">200 lbs</span>
                    <span className="text-xs text-wf-gray-600">&times;</span>
                    <span className="text-sm font-bold text-wf-red">10 reps</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 10. Gradient CTA Card */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-wf-red via-red-600 to-orange-500 p-5">
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mb-2">10. Gradient CTA Card</p>
          <h2 className="text-xl font-black text-white mb-1">Upgrade to Pro</h2>
          <p className="text-sm text-white/70 mb-4">Unlock featured workouts, AI training, and advanced analytics.</p>
          <button className="w-full py-3 bg-white text-black font-bold text-sm rounded-xl active:scale-[0.98] transition-transform">
            Start Free Trial
          </button>
        </div>

      </div>
    </div>
  );
}
