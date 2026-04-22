import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LEADERBOARD = [
  { rank: 1, name: 'Will M.', username: '@wmartin', score: 63, avatar: null, color: '#fbbf24' },
  { rank: 2, name: 'ZJ', username: '@zj_lifts', score: 58, avatar: null, color: '#9ca3af' },
  { rank: 3, name: 'You', username: '@you', score: 47, avatar: null, color: '#b45309', isYou: true },
  { rank: 4, name: 'Mike T.', username: '@miket', score: 42, avatar: null, color: 'rgba(255,255,255,0.3)' },
  { rank: 5, name: 'Sarah K.', username: '@sarahk', score: 38, avatar: null, color: 'rgba(255,255,255,0.3)' },
  { rank: 6, name: 'Chris R.', username: '@chrisr', score: 35, avatar: null, color: 'rgba(255,255,255,0.3)' },
  { rank: 7, name: 'Alex P.', username: '@alexp', score: 31, avatar: null, color: 'rgba(255,255,255,0.3)' },
  { rank: 8, name: 'Jordan L.', username: '@jordanl', score: 28, avatar: null, color: 'rgba(255,255,255,0.3)' },
];

export default function TestChallengeSection() {
  const navigate = useNavigate();
  const [challengeTab, setChallengeTab] = useState('active');
  const [accordionOpen, setAccordionOpen] = useState(null);

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Back button */}
      <div className="px-4 pt-6 mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      <div className="px-4">
        <h1 className="text-2xl font-black text-white mb-6">Test Challenge Section</h1>

        {/* Segmented Control */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
          {['active', 'upcoming', 'completed'].map(tab => (
            <button key={tab} onClick={() => setChallengeTab(tab)} style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', border: 'none', cursor: 'pointer',
              background: challengeTab === tab ? 'rgba(239,68,68,0.9)' : 'transparent',
              color: challengeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s ease',
            }}>{tab}</button>
          ))}
        </div>

        {/* Active Tab */}
        {challengeTab === 'active' && (
          <>
            {/* Hero Section — Nike style */}
            <div style={{
              position: 'relative', overflow: 'hidden', marginBottom: '16px',
              borderRadius: '2px',
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              {/* Red accent bar */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.5), transparent)' }} />
              {/* Red glow spotlight */}
              <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '70%', height: '160%', background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.7)', letterSpacing: '0.3em' }}>Active Challenge</p>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(239,68,68,0.9)', letterSpacing: '0.2em', textTransform: 'uppercase', background: 'rgba(239,68,68,0.12)', padding: '3px 8px', borderRadius: '2px', border: '1px solid rgba(239,68,68,0.3)' }}>Live</span>
                </div>
                <h3 className="text-[32px] font-black text-white leading-[0.9] tracking-tight" style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                  MAX PUSH-UPS
                </h3>
                <p className="text-[12px] text-white/40 font-light mt-2 mb-5">60 seconds — how many can you do?</p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginBottom: '18px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '36px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px', lineHeight: '0.9' }}>47</span>
                    <div className="text-[9px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.25em' }}>Your Best</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '36px', fontWeight: 900, color: '#ef4444', fontFamily: 'system-ui', letterSpacing: '-2px', lineHeight: '0.9' }}>63</span>
                    <div className="text-[9px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.25em' }}>#1 Spot</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '36px', fontWeight: 900, color: '#fbbf24', fontFamily: 'system-ui', letterSpacing: '-2px', lineHeight: '0.9' }}>#3</span>
                    <div className="text-[9px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.25em' }}>Your Rank</div>
                  </div>
                </div>

                {/* Countdown */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {[{ val: '2', label: 'Days' }, { val: '14', label: 'Hours' }, { val: '23', label: 'Min' }].map((t, i) => (
                    <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>{t.val}</div>
                      <div className="text-[8px] text-white/30 uppercase font-semibold mt-1.5" style={{ letterSpacing: '0.2em' }}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Leaderboard with Profile Avatars */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>
                Leaderboard
              </div>

              {/* Top 3 podium */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
                {[LEADERBOARD[1], LEADERBOARD[0], LEADERBOARD[2]].map((p, i) => {
                  const heights = ['100px', '120px', '85px'];
                  const sizes = ['52px', '64px', '48px'];
                  const borders = ['#9ca3af', '#fbbf24', '#b45309'];
                  const labels = ['2nd', '1st', '3rd'];
                  return (
                    <div key={p.rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      {/* Avatar */}
                      <div style={{
                        width: sizes[i], height: sizes[i], borderRadius: '50%',
                        background: `linear-gradient(135deg, ${borders[i]}30, ${borders[i]}10)`,
                        border: `2px solid ${borders[i]}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: i === 1 ? '24px' : '20px', fontWeight: 800, color: borders[i],
                        boxShadow: i === 1 ? `0 0 20px ${borders[i]}40` : 'none',
                      }}>
                        {p.name.charAt(0)}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>{p.name}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{p.username}</div>
                      </div>
                      {/* Podium bar */}
                      <div style={{
                        width: '70px', height: heights[i], borderRadius: '10px 10px 0 0',
                        background: `linear-gradient(180deg, ${borders[i]}25, ${borders[i]}08)`,
                        border: `1px solid ${borders[i]}30`, borderBottom: 'none',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                        paddingTop: '12px',
                      }}>
                        <div style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px' }}>{p.score}</div>
                        <div style={{ fontSize: '8px', color: borders[i], letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>{labels[i]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Remaining leaderboard rows */}
              <div style={{ borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {LEADERBOARD.slice(3).map((p, i, arr) => (
                  <div key={p.rank} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: p.isYou ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}>
                    {/* Rank */}
                    <div style={{ width: '24px', fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{p.rank}</div>
                    {/* Avatar */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                    }}>
                      {p.name.charAt(0)}
                    </div>
                    {/* Name */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: p.isYou ? '#ef4444' : 'white' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{p.username}</div>
                    </div>
                    {/* Score */}
                    <div style={{ fontSize: '16px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px' }}>{p.score}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accordion Sections */}
            <div style={{ borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
              {[
                { title: 'Rules & Scoring', icon: '📋', content: 'Complete as many push-ups as possible in 60 seconds. Must have full range of motion — chest to floor, arms fully extended at top. Record a video for verification. Top 3 win prizes.' },
                { title: 'Submit Your Entry', icon: '🎯', content: 'Record yourself doing push-ups for 60 seconds. Count your total and submit below with video proof. You can submit multiple times — only your best counts.' },
                { title: 'Prizes', icon: '🏆', content: '1st Place: $50 gift card + Gold badge\n2nd Place: $25 gift card + Silver badge\n3rd Place: $10 gift card + Bronze badge\nAll participants: Participation badge' },
              ].map((row, i) => (
                <div key={i}>
                  <button onClick={() => setAccordionOpen(accordionOpen === i ? null : i)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 20px', background: 'transparent', border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: '18px' }}>{row.icon}</span>
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'white', textAlign: 'left' }}>{row.title}</span>
                    <svg style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.4)', transform: accordionOpen === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </button>
                  {accordionOpen === i && (
                    <div style={{ padding: '12px 20px 16px 50px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, whiteSpace: 'pre-line', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {row.content}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <button
              style={{
                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(249,115,22,0.9))',
                color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 20px rgba(239,68,68,0.3)',
              }}
              className="active:scale-[0.98] transition-all"
            >
              Submit Your Entry
            </button>
          </>
        )}

        {/* Upcoming Tab — Nike style */}
        {challengeTab === 'upcoming' && (
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '2px',
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Orange accent bar */}
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #f97316, rgba(249,115,22,0.5), transparent)' }} />
            {/* Warm glow spotlight */}
            <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '70%', height: '160%', background: 'radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', padding: '28px 24px' }}>
              <p className="text-[10px] uppercase font-light mb-3" style={{ color: 'rgba(249,115,22,0.75)', letterSpacing: '0.3em' }}>Coming Soon</p>
              <h3 className="text-[28px] font-black text-white leading-[0.9] tracking-tight" style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                PLANK HOLD
              </h3>
              <p className="text-[11px] text-white/40 font-light mt-3 leading-relaxed">How long can you hold a plank?</p>
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold" style={{ color: 'rgba(249,115,22,0.75)', letterSpacing: '0.25em' }}>Starts Next Monday</span>
                <span className="text-[10px] text-white/30 uppercase font-medium" style={{ letterSpacing: '0.2em' }}>7 Days</span>
              </div>
            </div>
          </div>
        )}

        {/* Completed Tab — Nike style */}
        {challengeTab === 'completed' && (
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '2px',
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Green accent bar */}
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.5), transparent)' }} />
            {/* Green glow spotlight */}
            <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '70%', height: '160%', background: 'radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(34,197,94,0.75)', letterSpacing: '0.3em' }}>Completed</p>
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(34,197,94,0.9)', letterSpacing: '0.2em', textTransform: 'uppercase', background: 'rgba(34,197,94,0.12)', padding: '3px 8px', borderRadius: '2px', border: '1px solid rgba(34,197,94,0.3)' }}>Done</span>
              </div>
              <h3 className="text-[28px] font-black text-white leading-[0.9] tracking-tight" style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                1-REP MAX WEEK
              </h3>
              <p className="text-[11px] text-white/40 font-light mt-2">Completed Oct 12, 2025</p>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, padding: '12px 8px', borderRadius: '2px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>225</div>
                  <div className="text-[8px] text-white/30 uppercase font-semibold mt-1.5" style={{ letterSpacing: '0.25em' }}>Your Max</div>
                </div>
                <div style={{ flex: 1, padding: '12px 8px', borderRadius: '2px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#fbbf24', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>#5</div>
                  <div className="text-[8px] text-white/30 uppercase font-semibold mt-1.5" style={{ letterSpacing: '0.25em' }}>Final Rank</div>
                </div>
                <div style={{ flex: 1, padding: '12px 8px', borderRadius: '2px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>42</div>
                  <div className="text-[8px] text-white/30 uppercase font-semibold mt-1.5" style={{ letterSpacing: '0.25em' }}>Participants</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
