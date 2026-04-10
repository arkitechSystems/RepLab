import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CardsTest() {
  const navigate = useNavigate();
  const [toggleOn, setToggleOn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hoverCard, setHoverCard] = useState(null);
  const [breathPhase, setBreathPhase] = useState(0);
  const [activeTab, setActiveTab] = useState('week');
  const [sliderVal, setSliderVal] = useState(65);
  const [segmentTab, setSegmentTab] = useState('active');
  const [accordionOpen, setAccordionOpen] = useState(null);
  const [challengeTab, setChallengeTab] = useState('active');

  // Breathing animation timer
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathPhase(p => (p + 1) % 100);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-2">Cards. Test.</h1>
      <p className="text-wf-gray-400 text-sm mb-6">25 card styles for UI exploration</p>

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

        {/* ──── NEW EXPERIMENTAL CARDS ──── */}
        <div className="border-t border-white/10 pt-6 mt-4">
          <p className="text-wf-gray-400 text-xs uppercase tracking-widest font-semibold mb-5">Experimental Styles</p>
        </div>

        {/* 11. Brutalist / Newsprint Card */}
        <div style={{
          background: '#f5f0e8',
          border: '3px solid #1a1a1a',
          borderRadius: '0',
          padding: '0',
          fontFamily: '"Courier New", monospace',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#f5f0e8', fontSize: '10px', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>11. Brutalist</span>
            <span style={{ color: '#f5f0e8', fontSize: '10px', fontFamily: 'monospace' }}>03.22.26</span>
          </div>
          <div style={{ padding: '20px', borderBottom: '2px dashed #1a1a1a' }}>
            <h2 style={{ color: '#1a1a1a', fontSize: '32px', fontWeight: 900, lineHeight: 1, margin: 0, textTransform: 'uppercase', letterSpacing: '-1px' }}>
              DEADLIFT<br/>
              <span style={{ fontSize: '64px', lineHeight: 0.9 }}>315</span>
              <span style={{ fontSize: '16px', verticalAlign: 'super' }}>LBS</span>
            </h2>
          </div>
          <div style={{ display: 'flex', borderTop: '0' }}>
            {['SETS: 5', 'REPS: 3', 'RPE: 9'].map((stat, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '12px',
                textAlign: 'center',
                borderRight: i < 2 ? '2px solid #1a1a1a' : 'none',
                color: '#1a1a1a',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
              }}>{stat}</div>
            ))}
          </div>
          <div style={{
            background: '#ff3b3b',
            color: '#fff',
            padding: '10px 16px',
            fontSize: '11px',
            fontWeight: 900,
            textAlign: 'center',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            ► LOG THIS SET ◄
          </div>
        </div>

        {/* 12. Organic / Breathing Blob Card */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a1628 100%)',
          borderRadius: '24px',
          padding: '32px 24px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '200px',
        }}>
          {/* Animated blob background */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '180px',
            height: '180px',
            transform: `translate(-50%, -50%) scale(${0.8 + Math.sin(breathPhase * 0.063) * 0.2})`,
            borderRadius: `${40 + Math.sin(breathPhase * 0.04) * 15}% ${60 - Math.sin(breathPhase * 0.04) * 15}% ${50 + Math.cos(breathPhase * 0.05) * 10}% ${50 - Math.cos(breathPhase * 0.05) * 10}%`,
            background: `radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)`,
            filter: 'blur(20px)',
            transition: 'all 0.08s linear',
          }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: 'rgba(167,139,250,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>12. Organic Blob</p>
            <div style={{
              fontSize: '48px',
              fontWeight: 200,
              color: 'white',
              letterSpacing: '-2px',
              lineHeight: 1,
              fontFamily: 'system-ui',
            }}>
              {Math.round(60 + Math.sin(breathPhase * 0.063) * 8)}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(167,139,250,0.5)', marginTop: '4px', letterSpacing: '2px' }}>BPM</div>
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'center',
              gap: '3px',
            }}>
              {Array.from({ length: 30 }, (_, i) => {
                const h = 8 + Math.sin((breathPhase + i * 3) * 0.1) * 16;
                return (
                  <div key={i} style={{
                    width: '3px',
                    height: `${h}px`,
                    borderRadius: '2px',
                    background: `linear-gradient(to top, rgba(139,92,246,${0.3 + (h / 40)}), rgba(59,130,246,${0.3 + (h / 40)}))`,
                    transition: 'height 0.08s linear',
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* 13. Retro Terminal / Hacker Card */}
        <div style={{
          background: '#0c0c0c',
          border: '1px solid #00ff4130',
          borderRadius: '8px',
          fontFamily: '"Courier New", "Lucida Console", monospace',
          overflow: 'hidden',
          boxShadow: '0 0 30px rgba(0,255,65,0.05), inset 0 0 60px rgba(0,255,65,0.03)',
        }}>
          {/* Terminal header */}
          <div style={{
            background: '#151515',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderBottom: '1px solid #00ff4115',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
            <span style={{ color: '#00ff4160', fontSize: '10px', marginLeft: '8px' }}>replab@gym:~</span>
          </div>
          <div style={{ padding: '16px', lineHeight: 1.8 }}>
            <p style={{ fontSize: '10px', color: '#00ff4140', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>13. Terminal Card</p>
            <div style={{ color: '#00ff41', fontSize: '12px' }}>
              <span style={{ color: '#00ff4180' }}>$</span> query --user=will --type=workout_summary<br />
              <br />
              <span style={{ color: '#888' }}>{'// '}loading workout data...</span><br />
              <br />
              <span style={{ color: '#ffbd2e' }}>WORKOUT_LOG</span> = {'{'}<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"exercise"</span>: <span style={{ color: '#98c379' }}>"Squat"</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"weight"</span>:&nbsp;&nbsp; <span style={{ color: '#d19a66' }}>275</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"sets"</span>:&nbsp;&nbsp;&nbsp;&nbsp; <span style={{ color: '#d19a66' }}>4</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"reps"</span>:&nbsp;&nbsp;&nbsp;&nbsp; <span style={{ color: '#d19a66' }}>6</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"status"</span>:&nbsp;&nbsp; <span style={{ color: '#27c93f' }}>"PR_ACHIEVED"</span><br />
              {'}'}<br />
              <br />
              <span style={{ color: '#00ff4180' }}>$</span> <span style={{
                borderRight: '2px solid #00ff41',
                paddingRight: '2px',
                animation: 'none',
              }}>█</span>
            </div>
          </div>
        </div>

        {/* 14. Neumorphic / Soft UI Card */}
        <div style={{
          background: '#e0e5ec',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff',
        }}>
          <p style={{ fontSize: '10px', color: '#8a95a5', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>14. Neumorphic</p>

          {/* Segmented control */}
          <div style={{
            display: 'flex',
            background: '#e0e5ec',
            borderRadius: '12px',
            padding: '4px',
            boxShadow: 'inset 3px 3px 6px #b8bec7, inset -3px -3px 6px #ffffff',
            marginBottom: '20px',
          }}>
            {['week', 'month', 'year'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                color: activeTab === tab ? '#5b6abf' : '#8a95a5',
                background: activeTab === tab ? '#e0e5ec' : 'transparent',
                boxShadow: activeTab === tab ? '4px 4px 8px #b8bec7, -4px -4px 8px #ffffff' : 'none',
                transition: 'all 0.2s',
              }}>{tab}</button>
            ))}
          </div>

          {/* Stat blocks */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { label: 'Volume', value: '24,500', unit: 'lbs' },
              { label: 'Sessions', value: '5', unit: 'days' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1,
                background: '#e0e5ec',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#3a4255', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: '#8a95a5', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.unit}</div>
                <div style={{ fontSize: '11px', color: '#5b6abf', marginTop: '8px', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Neumorphic slider */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#8a95a5', fontWeight: 600 }}>Intensity</span>
              <span style={{ fontSize: '11px', color: '#5b6abf', fontWeight: 700 }}>{sliderVal}%</span>
            </div>
            <div style={{
              height: '8px',
              borderRadius: '4px',
              background: '#e0e5ec',
              boxShadow: 'inset 2px 2px 4px #b8bec7, inset -2px -2px 4px #ffffff',
              position: 'relative',
              cursor: 'pointer',
            }} onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              setSliderVal(Math.round(((e.clientX - rect.left) / rect.width) * 100));
            }}>
              <div style={{
                height: '100%',
                width: `${sliderVal}%`,
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${sliderVal}%`,
                transform: 'translate(-50%, -50%)',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#e0e5ec',
                boxShadow: '3px 3px 6px #b8bec7, -3px -3px 6px #ffffff',
              }} />
            </div>
          </div>
        </div>

        {/* 15. Glassmorphic Layered / Stacked Card */}
        <div style={{
          position: 'relative',
          minHeight: '240px',
          perspective: '1000px',
        }}>
          {/* Background decorative layers */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 25%, #48dbfb 50%, #ff9ff3 75%, #54a0ff 100%)',
            filter: 'blur(24px)',
            opacity: 0.3,
            transform: 'scale(0.95) translateY(8px)',
          }} />
          <div style={{
            position: 'relative',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '28px 24px',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 120, height: 120, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,107,107,0.3), rgba(254,202,87,0.1))',
              filter: 'blur(10px)',
            }} />
            <div style={{
              position: 'absolute', bottom: -20, left: -20,
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(72,219,251,0.3), rgba(84,160,255,0.1))',
              filter: 'blur(10px)',
            }} />

            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px', position: 'relative', zIndex: 1 }}>15. Glass Layers</p>

            {/* Floating mini cards */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
              {[
                { emoji: '🔥', val: '847', label: 'cal' },
                { emoji: '⏱', val: '52m', label: 'time' },
                { emoji: '💪', val: '12k', label: 'lbs' },
              ].map((item, i) => (
                <div key={i}
                  onPointerEnter={() => setHoverCard(i)}
                  onPointerLeave={() => setHoverCard(null)}
                  style={{
                    flex: 1,
                    background: hoverCard === i
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    padding: '14px 8px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transform: hoverCard === i ? 'translateY(-4px) scale(1.03)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{item.emoji}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>{item.val}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Tag pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              {['Upper Body', 'Strength', 'PR Day', 'Progressive'].map((tag, i) => (
                <span key={i} style={{
                  padding: '5px 12px',
                  borderRadius: '100px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  background: [
                    'rgba(255,107,107,0.15)',
                    'rgba(254,202,87,0.15)',
                    'rgba(72,219,251,0.15)',
                    'rgba(255,159,243,0.15)',
                  ][i],
                  color: [
                    '#ff6b6b',
                    '#feca57',
                    '#48dbfb',
                    '#ff9ff3',
                  ][i],
                  border: `1px solid ${[
                    'rgba(255,107,107,0.2)',
                    'rgba(254,202,87,0.2)',
                    'rgba(72,219,251,0.2)',
                    'rgba(255,159,243,0.2)',
                  ][i]}`,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 16. Polaroid / Film Card */}
        <div style={{
          background: '#fafafa',
          borderRadius: '4px',
          padding: '12px 12px 40px 12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)',
          transform: 'rotate(-1.5deg)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderRadius: '2px',
            height: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 10, left: 12, fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>16. Polaroid</div>
            <div style={{ fontSize: '56px', fontWeight: 900, color: 'white', lineHeight: 1 }}>225</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '4px' }}>LBS × 8 REPS</div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '4px' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i <= 4 ? '#e94560' : 'rgba(255,255,255,0.2)' }} />
              ))}
            </div>
          </div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <span style={{ fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#333', fontWeight: 600 }}>Bench Press — PR Day</span>
          </div>
        </div>

        {/* 17. Ticket / Receipt Card */}
        <div style={{
          background: '#1a1a1a',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: '2px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>17. Ticket</p>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginTop: '4px' }}>Upper Body A</h3>
              </div>
              <div style={{ background: '#ef4444', borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: 'white' }}>A</span>
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {['Bench Press — 4×8', 'OHP — 3×10', 'Rows — 4×10', 'Curls — 3×12'].map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{ex}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>✓</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Total Volume</span>
            <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 700 }}>18,400 lbs</span>
          </div>
        </div>

        {/* 18. Dashboard / Bento Grid Card */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: '8px',
        }}>
          <div style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, #0f0f0f, #1a1a2e)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>18. Bento Grid</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '60px' }}>
              {[40,65,50,80,55,90,70,85,95,60,75,88].map((h, i) => (
                <div key={i} style={{ width: '100%', maxWidth: '22px', height: `${h}%`, borderRadius: '4px 4px 0 0', background: `linear-gradient(to top, rgba(239,68,68,0.6), rgba(239,68,68,${0.2 + h/200}))` }} />
              ))}
            </div>
          </div>
          {[
            { val: '5/7', label: 'DAYS', color: '#22c55e' },
            { val: '312', label: 'STREAK', color: '#ef4444' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 19. Magazine / Editorial Card */}
        <div style={{
          background: '#0a0a0a',
          borderRadius: '0',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 20px 16px' }}>
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600 }}>19. Editorial</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '12px' }}>
              <span style={{ fontSize: '72px', fontWeight: 100, color: 'white', lineHeight: 0.85, fontFamily: 'Georgia, serif' }}>5</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 300, color: 'white', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>exercises</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Georgia, serif', marginTop: '2px' }}>for maximum hypertrophy</div>
              </div>
            </div>
          </div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 20px' }} />
          <div style={{ padding: '16px 20px', display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Focus</div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Chest & Triceps</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Duration</div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>48 min</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Level</div>
              <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>Advanced</div>
            </div>
          </div>
        </div>

        {/* 20. Neon Outline Card */}
        <div style={{
          background: '#050505',
          borderRadius: '20px',
          border: '1px solid rgba(0,255,136,0.3)',
          padding: '24px',
          boxShadow: '0 0 20px rgba(0,255,136,0.05), inset 0 0 20px rgba(0,255,136,0.02)',
          position: 'relative',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(0,255,136,0.4)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>20. Neon Outline</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              border: '2px solid rgba(0,255,136,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0,255,136,0.15)',
            }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#00ff88' }}>PR</span>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>Deadlift</div>
              <div style={{ fontSize: '13px', color: 'rgba(0,255,136,0.6)' }}>365 lbs × 3 reps</div>
            </div>
          </div>
          <div style={{
            marginTop: '16px', padding: '10px 16px', borderRadius: '10px',
            background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)',
            fontSize: '11px', color: 'rgba(0,255,136,0.7)', textAlign: 'center', fontWeight: 600,
          }}>
            +15 LBS FROM LAST SESSION
          </div>
        </div>

        {/* 21. Split Diagonal Card */}
        <div style={{
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          height: '180px',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: '#ef4444', clipPath: 'polygon(0 0, 100% 0, 60% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: '#1a1a1a', clipPath: 'polygon(60% 0, 100% 0, 100% 100%, 40% 100%)' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', height: '100%' }}>
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>21. Split</p>
              <div style={{ fontSize: '36px', fontWeight: 900, color: 'white', lineHeight: 1, marginTop: '4px' }}>PUSH</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>6 exercises</div>
            </div>
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '36px', fontWeight: 900, color: 'white', lineHeight: 1 }}>PULL</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>5 exercises</div>
            </div>
          </div>
        </div>

        {/* 22. Minimal Line Card */}
        <div style={{
          background: 'transparent',
          borderLeft: '3px solid #ef4444',
          paddingLeft: '20px',
          paddingTop: '4px',
          paddingBottom: '4px',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>22. Minimal Line</p>
          <div style={{ fontSize: '14px', color: 'white', fontWeight: 700, marginBottom: '4px' }}>Squat — 275 lbs</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>4 sets × 6 reps · RPE 8.5</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[275, 275, 275, 265].map((w, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: '6px',
                background: i < 3 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${i < 3 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                fontSize: '11px', fontWeight: 700,
                color: i < 3 ? '#22c55e' : 'rgba(255,255,255,0.4)',
              }}>{w}</div>
            ))}
          </div>
        </div>

        {/* 23. Stacked Paper Card */}
        <div style={{ position: 'relative', paddingTop: '8px', paddingLeft: '4px' }}>
          <div style={{ position: 'absolute', top: 0, left: 8, right: -4, bottom: 8, background: '#1a1a1a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', transform: 'rotate(1.5deg)' }} />
          <div style={{ position: 'absolute', top: 4, left: 4, right: 0, bottom: 4, background: '#151515', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', transform: 'rotate(0.5deg)' }} />
          <div style={{ position: 'relative', background: '#111', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', zIndex: 1 }}>
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>23. Stacked Paper</p>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Week 4 of 8</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Upper/Lower Split — Strength Phase</div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: '50%', borderRadius: '3px', background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
              <span>16 sessions done</span>
              <span>16 remaining</span>
            </div>
          </div>
        </div>

        {/* 24. Metric Dashboard Card */}
        <div style={{
          background: 'linear-gradient(145deg, #0f0f0f, #0a0a0a)',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>24. Metric Dashboard</p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Bench', val: '225', delta: '+10', up: true },
              { label: 'Squat', val: '315', delta: '+15', up: true },
              { label: 'Dead', val: '365', delta: '-5', up: false },
            ].map((m, i) => (
              <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{m.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: 'white', lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: m.up ? '#22c55e' : '#ef4444', marginTop: '4px' }}>
                  {m.delta} lbs
                </div>
              </div>
            ))}
          </div>
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '10px', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>🏆</span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Total: <span style={{ color: '#ef4444', fontWeight: 800 }}>905 lbs</span> Powerlifting Total</span>
          </div>
        </div>

        {/* 25. Gradient Mesh Card */}
        <div style={{
          borderRadius: '24px',
          overflow: 'hidden',
          position: 'relative',
          minHeight: '220px',
          background: '#0a0a0a',
        }}>
          {/* Mesh gradient blobs */}
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 70%)', filter: 'blur(30px)' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)', filter: 'blur(30px)' }} />
          <div style={{ position: 'absolute', top: '30%', right: '20%', width: '40%', height: '50%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)', filter: 'blur(25px)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '28px 24px' }}>
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '20px' }}>25. Gradient Mesh</p>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: '8px' }}>
              Your Next<br />Workout
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Push Day — 6 exercises, ~45 min</div>
            <button style={{
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px',
              padding: '12px 24px', color: 'white', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.5px',
            }}>
              Start Now →
            </button>
          </div>
        </div>

        {/* 26. Frosted Glass Split */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', display: 'flex', minHeight: '160px' }}>
          <div style={{ flex: 1, background: 'rgba(239,68,68,0.15)', backdropFilter: 'blur(20px)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>26. Frosted Split</p>
            <div style={{ fontSize: '32px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>185</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>LBS BENCH PR</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Recent Sets</div>
            {['185×5', '175×8', '165×10'].map((s, i) => (
              <div key={i} style={{ fontSize: '13px', color: 'white', fontWeight: 600, marginBottom: '6px' }}>{s}</div>
            ))}
          </div>
        </div>

        {/* 27. Neon Outline */}
        <div style={{
          borderRadius: '20px', padding: '24px', position: 'relative',
          background: '#0a0a0a',
          border: '1px solid rgba(239,68,68,0.4)',
          boxShadow: '0 0 20px rgba(239,68,68,0.15), inset 0 0 20px rgba(239,68,68,0.05)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>27. Neon Outline</p>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Upper Body A</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Chest, Shoulders, Triceps</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Bench', 'OHP', 'Dips', 'Flies'].map((ex, i) => (
              <span key={i} style={{ fontSize: '10px', color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{ex}</span>
            ))}
          </div>
        </div>

        {/* 28. Countdown Timer Card */}
        <div style={{
          borderRadius: '20px', padding: '28px', textAlign: 'center',
          background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>28. Countdown</p>
          <div style={{ fontSize: '56px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-4px', lineHeight: 1 }}>
            {Math.floor(90 - (breathPhase % 90))}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(239,68,68,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginTop: '8px' }}>Seconds Rest</div>
          <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', marginTop: '20px' }}>
            <div style={{ height: '100%', width: `${((breathPhase % 90) / 90) * 100}%`, borderRadius: '2px', background: 'linear-gradient(90deg, #ef4444, #f97316)', transition: 'width 0.08s linear' }} />
          </div>
        </div>

        {/* 29. Floating Badge Card */}
        <div style={{
          borderRadius: '20px', padding: '24px', position: 'relative',
          background: 'linear-gradient(135deg, #0f0f0f, #1a1a1a)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ position: 'absolute', top: '-12px', right: '16px', background: '#ef4444', borderRadius: '10px', padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}>NEW</div>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>29. Badge Card</p>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>German Volume Training</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>10×10 — Maximum hypertrophy protocol</div>
        </div>

        {/* 30. Progress Ring Card */}
        <div style={{
          borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px',
          background: '#111', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', shrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="16" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="100" strokeDashoffset={100 - 72} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: 'white' }}>72%</div>
          </div>
          <div>
            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>30. Progress Ring</p>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Week 9 of 12</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Hypertrophy Phase</div>
          </div>
        </div>

        {/* 31. Horizontal Scroll Chips */}
        <div style={{
          borderRadius: '20px', padding: '20px', paddingRight: 0,
          background: '#111', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px', paddingRight: '20px' }}>31. Scroll Chips</p>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', paddingRight: '20px' }}>
            {['Push', 'Pull', 'Legs', 'Arms', 'Core', 'Cardio', 'Stretch'].map((tag, i) => (
              <div key={i} style={{
                shrink: 0, padding: '10px 18px', borderRadius: '12px', whiteSpace: 'nowrap',
                background: i === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${i === 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: i === 0 ? '#ef4444' : 'rgba(255,255,255,0.5)',
                fontSize: '12px', fontWeight: 600,
              }}>{tag}</div>
            ))}
          </div>
        </div>

        {/* 32. Before/After Slider */}
        <div style={{
          borderRadius: '20px', padding: '24px',
          background: '#111', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>32. Before / After</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 200, color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui', letterSpacing: '-2px' }}>135</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>Week 1</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg style={{ width: '24px', height: '24px', color: '#22c55e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>185</div>
              <div style={{ fontSize: '9px', color: 'rgba(34,197,94,0.6)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>Week 12</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '13px', color: '#22c55e', fontWeight: 700 }}>+50 lbs on Bench Press</div>
        </div>

        {/* 33. Streak Flame Card */}
        <div style={{
          borderRadius: '20px', padding: '28px', textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(249,115,22,0.08) 0%, #0a0a0a 50%)',
          border: '1px solid rgba(249,115,22,0.15)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(249,115,22,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>33. Streak Flame</p>
          <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '8px' }}>🔥</div>
          <div style={{ fontSize: '36px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px', lineHeight: 1 }}>14</div>
          <div style={{ fontSize: '10px', color: 'rgba(249,115,22,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginTop: '6px' }}>Day Streak</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} style={{ width: '28px', height: '28px', borderRadius: '6px', background: i < 5 ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i < 5 ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: i < 5 ? '#f97316' : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
                {['M','T','W','T','F','S','S'][i]}
              </div>
            ))}
          </div>
        </div>

        {/* 34. Leaderboard Card */}
        <div style={{
          borderRadius: '20px', padding: '20px',
          background: '#111', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px' }}>34. Leaderboard</p>
          {[
            { rank: 1, name: 'Will M.', val: '315 lbs', color: '#fbbf24' },
            { rank: 2, name: 'ZJ', val: '285 lbs', color: '#9ca3af' },
            { rank: 3, name: 'Mike T.', val: '265 lbs', color: '#b45309' },
          ].map((r) => (
            <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: r.rank < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${r.color}20`, border: `1px solid ${r.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: r.color }}>{r.rank}</div>
              <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'white' }}>{r.name}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: r.color }}>{r.val}</div>
            </div>
          ))}
        </div>

        {/* 35. Compact Stat Row */}
        <div style={{
          borderRadius: '20px', padding: '16px 20px',
          background: '#111', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: '20px', height: '20px', color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
            </div>
            <div>
              <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>35. Compact Row</p>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginTop: '2px' }}>Total Volume</div>
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px' }}>24,800</div>
        </div>

        {/* 36. Segmented Control + Tab Views */}
        <div style={{ borderRadius: '20px', padding: '20px', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px' }}>36. Segmented Control</p>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
            {['active', 'upcoming', 'completed'].map(tab => (
              <button key={tab} onClick={() => setSegmentTab(tab)} style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', border: 'none', cursor: 'pointer',
                background: segmentTab === tab ? 'rgba(239,68,68,0.9)' : 'transparent',
                color: segmentTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.2s ease',
              }}>{tab}</button>
            ))}
          </div>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
              {segmentTab === 'active' ? 'Max Push-Ups Challenge — 3 days left' : segmentTab === 'upcoming' ? 'Plank Hold Challenge — starts next Monday' : '1-Rep Max Week — completed Oct 12'}
            </div>
          </div>
        </div>

        {/* 37. Hero Banner with Parallax */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', position: 'relative', minHeight: '200px', background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0808 50%, #1a0505 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 40%, rgba(239,68,68,0.3) 0%, transparent 60%)', filter: 'blur(20px)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 70%, rgba(249,115,22,0.2) 0%, transparent 60%)', filter: 'blur(25px)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '28px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '200px' }}>
            <p style={{ fontSize: '9px', color: 'rgba(239,68,68,0.7)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>37. Hero Banner</p>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: '6px' }}>Max Push-Ups</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>How many can you do in 60 seconds?</div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div><span style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui' }}>47</span><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>YOUR BEST</span></div>
              <div><span style={{ fontSize: '22px', fontWeight: 200, color: '#ef4444', fontFamily: 'system-ui' }}>63</span><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>#1 SPOT</span></div>
            </div>
          </div>
        </div>

        {/* 38. Sticky Section Headers */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.06)', maxHeight: '280px', overflowY: 'auto' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, padding: '16px 20px 8px' }}>38. Sticky Headers</p>
          {['This Week', 'Upcoming', 'Past'].map(section => (
            <div key={section}>
              <div style={{ position: 'sticky', top: 0, background: '#1a1a1a', padding: '8px 20px', fontSize: '11px', fontWeight: 700, color: 'rgba(239,68,68,0.7)', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.04)', zIndex: 1 }}>{section}</div>
              {['Challenge A', 'Challenge B', 'Challenge C'].map((c, i) => (
                <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'white', fontWeight: 500 }}>{c}</span>
                  <svg style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 39. Inline Metrics Bar */}
        <div style={{ borderRadius: '20px', padding: '16px 20px', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>39. Inline Metrics Bar</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {[
              { label: 'Rank', value: '#3', color: '#fbbf24' },
              { label: 'Participants', value: '128', color: 'white' },
              { label: 'Time Left', value: '2d 14h', color: '#ef4444' },
              { label: 'Your Best', value: '47', color: '#22c55e' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 200, color: m.color, fontFamily: 'system-ui', letterSpacing: '-1px' }}>{m.value}</div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 40. iOS Table Style Rows */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, padding: '16px 20px 8px' }}>40. iOS Table Rows</p>
          {[
            { icon: '🏆', title: 'Max Push-Ups', sub: 'Active · 3 days left', accent: '#ef4444' },
            { icon: '⏱️', title: 'Plank Hold', sub: 'Upcoming · Starts Monday', accent: '#f97316' },
            { icon: '💪', title: '1-Rep Max Week', sub: 'Completed · Oct 12', accent: '#22c55e' },
            { icon: '🔥', title: '30-Day Streak', sub: 'Active · Day 14 of 30', accent: '#fbbf24' },
          ].map((row, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ fontSize: '24px', width: '36px', textAlign: 'center' }}>{row.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'white' }}>{row.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{row.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.accent }} />
                <svg style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </div>
            </div>
          ))}
        </div>

        {/* 41. Accordion / Expandable Sections */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, padding: '16px 20px 8px' }}>41. Accordion</p>
          {['Rules & Scoring', 'Your Entry', 'Leaderboard'].map((section, i) => (
            <div key={i}>
              <button onClick={() => setAccordionOpen(accordionOpen === i ? null : i)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer', color: 'white',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{section}</span>
                <svg style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.4)', transform: accordionOpen === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
              {accordionOpen === i && (
                <div style={{ padding: '12px 20px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {i === 0 ? 'Complete as many push-ups as possible in 60 seconds. Must have full range of motion. Record a video for verification.' : i === 1 ? 'Your best: 47 push-ups. Submitted Oct 15, 2025. Rank: #3 of 128.' : '1. Will M. — 63  ·  2. ZJ — 58  ·  3. You — 47  ·  4. Mike T. — 42'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 42. Bottom Sheet Preview */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', minHeight: '200px' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, padding: '16px 20px' }}>42. Bottom Sheet</p>
          <div style={{ padding: '0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Content behind the sheet...</div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#1a1a1a', borderRadius: '16px 16px 0 0', padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Max Push-Ups Challenge</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Swipe up to see details</div>
          </div>
        </div>

        {/* 43. Timeline / Activity Feed */}
        <div style={{ borderRadius: '20px', padding: '20px', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px' }}>43. Timeline Feed</p>
          {[
            { time: 'Just now', text: 'You submitted 47 push-ups', color: '#22c55e' },
            { time: '2h ago', text: 'ZJ beat your record with 58', color: '#ef4444' },
            { time: 'Yesterday', text: 'Challenge started — 128 participants', color: '#3b82f6' },
            { time: 'Oct 10', text: 'You joined Max Push-Ups Challenge', color: '#f97316' },
          ].map((event, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: event.color, shrink: 0 }} />
                {i < arr.length - 1 && <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: '4px' }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? '16px' : '0' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{event.time}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{event.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 44. Carousel Preview */}
        <div style={{ borderRadius: '20px', padding: '20px', paddingRight: 0, background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px', paddingRight: '20px' }}>44. Carousel</p>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', paddingRight: '20px' }}>
            {[
              { name: 'Max Push-Ups', status: 'Active', color: '#ef4444' },
              { name: 'Plank Hold', status: 'Upcoming', color: '#f97316' },
              { name: '1-Rep Max', status: 'Completed', color: '#22c55e' },
            ].map((c, i) => (
              <div key={i} style={{
                minWidth: '200px', padding: '20px', borderRadius: '16px', shrink: 0,
                background: `linear-gradient(135deg, ${c.color}15, transparent)`,
                border: `1px solid ${c.color}30`,
              }}>
                <div style={{ fontSize: '8px', color: c.color, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>{c.status}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Tap to view →</div>
              </div>
            ))}
          </div>
        </div>

        {/* 45. Dashboard Bento Grid */}
        <div style={{ borderRadius: '20px', padding: '20px', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px' }}>45. Bento Grid</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ gridColumn: 'span 2', padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), transparent)', border: '1px solid rgba(239,68,68,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>47</div>
              <div style={{ fontSize: '10px', color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Your Best Push-Ups</div>
            </div>
            <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 200, color: '#fbbf24', fontFamily: 'system-ui' }}>#3</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px' }}>Rank</div>
            </div>
            <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 200, color: '#ef4444', fontFamily: 'system-ui' }}>2d</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4px' }}>Time Left</div>
            </div>
          </div>
        </div>

        {/* 46. Test Challenge Section (Combines #36 Segmented + #40 iOS Table + #41 Accordion) */}
        <div style={{ borderRadius: '20px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, padding: '16px 20px 8px' }}>46. Test Challenge Section</p>

          {/* Segmented Control */}
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px' }}>
              {['active', 'upcoming', 'completed'].map(tab => (
                <button key={tab} onClick={() => setChallengeTab(tab)} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', border: 'none', cursor: 'pointer',
                  background: challengeTab === tab ? 'rgba(239,68,68,0.9)' : 'transparent',
                  color: challengeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s ease',
                }}>{tab}</button>
              ))}
            </div>
          </div>

          {/* Hero stat for active challenge */}
          {challengeTab === 'active' && (
            <div style={{ padding: '12px 20px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Active Challenge</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Max Push-Ups</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>60 seconds — how many can you do?</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
                <div><span style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui' }}>47</span><div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Your Best</div></div>
                <div><span style={{ fontSize: '28px', fontWeight: 200, color: '#ef4444', fontFamily: 'system-ui' }}>63</span><div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>#1 Spot</div></div>
                <div><span style={{ fontSize: '28px', fontWeight: 200, color: '#fbbf24', fontFamily: 'system-ui' }}>#3</span><div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Your Rank</div></div>
              </div>
            </div>
          )}

          {/* iOS Table Rows */}
          {challengeTab === 'active' && (
            <>
              {[
                { title: 'Rules & Scoring', content: 'Complete as many push-ups as possible in 60 seconds. Full ROM required. Record a video for verification. Top 3 win prizes.' },
                { title: 'Submit Your Entry', content: 'Record yourself doing push-ups for 60 seconds. Count your total and submit below with video proof.' },
                { title: 'Leaderboard', content: '1. Will M. — 63 push-ups\n2. ZJ — 58 push-ups\n3. You — 47 push-ups\n4. Mike T. — 42 push-ups\n5. Sarah K. — 38 push-ups' },
                { title: 'Time Remaining', content: '2 days, 14 hours, 23 minutes' },
              ].map((row, i) => (
                <div key={i}>
                  <button onClick={() => setAccordionOpen(accordionOpen === `c${i}` ? null : `c${i}`)} style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', background: 'transparent', border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{row.title}</span>
                    <svg style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.4)', transform: accordionOpen === `c${i}` ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </button>
                  {accordionOpen === `c${i}` && (
                    <div style={{ padding: '12px 20px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, whiteSpace: 'pre-line', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {row.content}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {challengeTab === 'upcoming' && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>Plank Hold Challenge starts next Monday</div>
            </div>
          )}

          {challengeTab === 'completed' && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>1-Rep Max Week — You placed #5</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
