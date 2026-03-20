import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WorkoutSessionTest() {
  const navigate = useNavigate();
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [swipedSets, setSwipedSets] = useState(new Set());
  const [tileDone, setTileDone] = useState(new Set());
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [focusSet, setFocusSet] = useState(1);
  const [wheelWeight, setWheelWeight] = useState(200);
  const [wheelReps, setWheelReps] = useState(10);
  const [stepWeight, setStepWeight] = useState(200);
  const [stepReps, setStepReps] = useState(10);
  const [voiceText, setVoiceText] = useState('');

  // Rest timer
  useEffect(() => {
    if (timerSeconds === null || timerSeconds <= 0) return;
    const t = setTimeout(() => setTimerSeconds(timerSeconds - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSeconds]);

  const sets = [
    { num: 1, weight: 200, reps: 10 },
    { num: 2, weight: 200, reps: 10 },
    { num: 3, weight: 200, reps: 10 },
  ];

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-2">Workout Session. Test.</h1>
      <p className="text-wf-gray-400 text-sm mb-6">Bench Press &middot; 3 sets &middot; 200 lbs</p>

      <div className="space-y-5">

        {/* 1. Wheel Picker Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">1. Wheel Picker Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press — Set 1</h3>
          </div>
          <div className="p-5 flex items-center justify-center gap-8">
            <div className="text-center">
              <label className="text-[9px] text-wf-gray-500 uppercase tracking-widest block mb-2">Weight</label>
              <div className="relative h-24 overflow-hidden w-20">
                <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 border-y border-wf-red/30 pointer-events-none z-10" />
                <div className="flex flex-col items-center justify-center h-full">
                  <button onClick={() => setWheelWeight(w => w + 5)} className="text-wf-gray-600 text-sm py-1">▲</button>
                  <span className="text-2xl font-black text-white py-1">{wheelWeight}</span>
                  <button onClick={() => setWheelWeight(w => Math.max(0, w - 5))} className="text-wf-gray-600 text-sm py-1">▼</button>
                </div>
              </div>
              <span className="text-[10px] text-wf-gray-500">lbs</span>
            </div>
            <span className="text-2xl text-wf-gray-600 font-bold mt-4">×</span>
            <div className="text-center">
              <label className="text-[9px] text-wf-gray-500 uppercase tracking-widest block mb-2">Reps</label>
              <div className="relative h-24 overflow-hidden w-16">
                <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 border-y border-wf-red/30 pointer-events-none z-10" />
                <div className="flex flex-col items-center justify-center h-full">
                  <button onClick={() => setWheelReps(r => r + 1)} className="text-wf-gray-600 text-sm py-1">▲</button>
                  <span className="text-2xl font-black text-white py-1">{wheelReps}</span>
                  <button onClick={() => setWheelReps(r => Math.max(0, r - 1))} className="text-wf-gray-600 text-sm py-1">▼</button>
                </div>
              </div>
              <span className="text-[10px] text-wf-gray-500">reps</span>
            </div>
          </div>
        </div>

        {/* 2. Large Button Stepper Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">2. Large Button Stepper Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press — Set 1</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[9px] text-wf-gray-500 uppercase tracking-widest block mb-2">Weight</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setStepWeight(w => Math.max(0, w - 5))} className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl font-bold active:scale-90 transition-transform">−</button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-black text-white">{stepWeight}</span>
                  <span className="text-sm text-wf-gray-500 ml-1">lbs</span>
                </div>
                <button onClick={() => setStepWeight(w => w + 5)} className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl font-bold active:scale-90 transition-transform">+</button>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-wf-gray-500 uppercase tracking-widest block mb-2">Reps</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setStepReps(r => Math.max(0, r - 1))} className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl font-bold active:scale-90 transition-transform">−</button>
                <div className="flex-1 text-center">
                  <span className="text-4xl font-black text-wf-red">{stepReps}</span>
                </div>
                <button onClick={() => setStepReps(r => r + 1)} className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl font-bold active:scale-90 transition-transform">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Swipe-to-Complete Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">3. Swipe-to-Complete Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press</h3>
          </div>
          <div className="divide-y divide-white/5">
            {sets.map(s => {
              const done = swipedSets.has(s.num);
              return (
                <div
                  key={s.num}
                  onClick={() => setSwipedSets(prev => { const n = new Set(prev); done ? n.delete(s.num) : n.add(s.num); return n; })}
                  className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors duration-300 ${done ? 'bg-green-500/10' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${done ? 'bg-green-500 border-green-500' : 'border-wf-gray-500'}`}>
                      {done && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </div>
                    <span className="text-sm text-wf-gray-400 font-bold">Set {s.num}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{s.weight} lbs</span>
                    <span className="text-xs text-wf-gray-600">×</span>
                    <span className="text-sm font-bold text-wf-red">{s.reps}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-wf-gray-500 text-center py-2">Tap to complete/uncomplete</p>
        </div>

        {/* 4. Floating Input Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">4. Floating Input Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press</h3>
          </div>
          <div className="divide-y divide-white/5">
            {sets.map(s => (
              <button key={s.num} onClick={() => setFloatingOpen(true)} className="w-full px-5 py-3 flex items-center justify-between active:bg-white/5 transition-colors">
                <span className="text-sm text-wf-gray-400 font-bold">Set {s.num}</span>
                <span className="text-sm text-wf-gray-500">{s.weight} × {s.reps}</span>
              </button>
            ))}
          </div>
        </div>
        {floatingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setFloatingOpen(false)}>
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-white text-center mb-4">Edit Set</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[9px] text-wf-gray-500 uppercase tracking-wider block mb-1">Weight</label>
                  <input type="number" defaultValue="200" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-wf-red/50" />
                </div>
                <div>
                  <label className="text-[9px] text-wf-gray-500 uppercase tracking-wider block mb-1">Reps</label>
                  <input type="number" defaultValue="10" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-wf-red/50" />
                </div>
              </div>
              <button onClick={() => setFloatingOpen(false)} className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm">Save Set</button>
            </div>
          </div>
        )}

        {/* 5. Rest Timer Integrated Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">5. Rest Timer Integrated Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press — Set 1</h3>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div><span className="text-2xl font-black text-white">200</span><span className="text-sm text-wf-gray-500 ml-1">lbs</span></div>
              <span className="text-xl text-wf-gray-600">×</span>
              <div><span className="text-2xl font-black text-wf-red">10</span><span className="text-sm text-wf-gray-500 ml-1">reps</span></div>
            </div>
            <button
              onClick={() => setTimerSeconds(90)}
              className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold active:scale-[0.98] transition-all mb-3"
            >
              {timerSeconds !== null && timerSeconds > 0 ? `Rest: ${Math.floor(timerSeconds / 60)}:${String(timerSeconds % 60).padStart(2, '0')}` : 'Complete Set → Start Rest Timer'}
            </button>
            {timerSeconds !== null && timerSeconds > 0 && (
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${(timerSeconds / 90) * 100}%` }} />
              </div>
            )}
          </div>
        </div>

        {/* 6. Previous Session Ghost Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">6. Previous Session Ghost Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press</h3>
          </div>
          <div className="px-3 pt-2 pb-1 flex items-center text-[9px] text-wf-gray-500 uppercase tracking-wider">
            <div className="w-10 text-center">Set</div>
            <div className="flex-1 text-center">Last</div>
            <div className="flex-1 text-center">Weight</div>
            <div className="flex-1 text-center">Reps</div>
          </div>
          {sets.map(s => (
            <div key={s.num} className="px-3 py-2.5 flex items-center border-t border-white/5">
              <div className="w-10 text-center text-sm text-wf-gray-500 font-bold">{s.num}</div>
              <div className="flex-1 text-center text-sm text-wf-gray-600 font-mono">185×8</div>
              <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none mx-1" defaultValue={s.weight} />
              <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none mx-1" defaultValue={s.reps} />
            </div>
          ))}
          <p className="text-[10px] text-wf-gray-600 text-center py-2 italic">Ghost column shows last session data</p>
        </div>

        {/* 7. Horizontal Set Scroller */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">7. Horizontal Set Scroller</p>
            <h3 className="text-base font-semibold text-white">Bench Press</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 py-4 snap-x">
            {sets.map(s => (
              <div key={s.num} onClick={() => setFocusSet(s.num)} className={`snap-center shrink-0 w-28 rounded-xl p-4 text-center cursor-pointer active:scale-95 transition-all border ${focusSet === s.num ? 'border-wf-red bg-wf-red/10' : 'border-white/10 bg-white/5'}`}>
                <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mb-1">Set {s.num}</div>
                <div className="text-xl font-black text-white">{s.weight}</div>
                <div className="text-xs text-wf-gray-400">lbs</div>
                <div className="mt-1 text-lg font-bold text-wf-red">{s.reps}</div>
                <div className="text-xs text-wf-gray-400">reps</div>
              </div>
            ))}
            <div className="snap-center shrink-0 w-28 rounded-xl p-4 text-center border border-dashed border-white/15 flex items-center justify-center cursor-pointer active:scale-95 transition-transform">
              <span className="text-wf-gray-500 text-2xl">+</span>
            </div>
          </div>
        </div>

        {/* 8. One Rep Max Projection Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">8. One Rep Max Projection Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press</h3>
          </div>
          <div className="divide-y divide-white/5">
            {sets.map(s => {
              const e1rm = Math.round(s.weight * (1 + s.reps / 30));
              return (
                <div key={s.num} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-wf-gray-400 font-bold">Set {s.num}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{s.weight} lbs</span>
                      <span className="text-xs text-wf-gray-600">×</span>
                      <span className="text-sm font-bold text-wf-red">{s.reps}</span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] text-wf-gray-600">Est. 1RM:</span>
                    <span className="text-xs font-bold text-purple-400">{e1rm} lbs</span>
                    <div className="flex-1 h-1 bg-white/5 rounded-full ml-2 overflow-hidden">
                      <div className="h-full bg-purple-500/50 rounded-full" style={{ width: `${Math.min(100, (e1rm / 300) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 9. Quick Log Tile Grid */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">9. Quick Log Tile Grid</p>
            <h3 className="text-base font-semibold text-white">Bench Press</h3>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {sets.map(s => {
              const done = tileDone.has(s.num);
              return (
                <button
                  key={s.num}
                  onClick={() => setTileDone(prev => { const n = new Set(prev); done ? n.delete(s.num) : n.add(s.num); return n; })}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all active:scale-95 ${done ? 'bg-green-500/15 border-green-500/30' : 'bg-white/5 border-white/10'}`}
                >
                  <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mb-1">Set {s.num}</div>
                  <div className={`text-2xl font-black ${done ? 'text-green-400' : 'text-white'}`}>{s.weight}</div>
                  <div className="text-xs text-wf-gray-400">lbs</div>
                  <div className={`text-lg font-bold mt-0.5 ${done ? 'text-green-400' : 'text-wf-red'}`}>{s.reps} reps</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 10. Voice Input Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold">10. Voice Input Card</p>
            <h3 className="text-base font-semibold text-white">Bench Press — Set 1</h3>
          </div>
          <div className="p-5 text-center">
            <div className="flex items-center justify-center gap-6 mb-4">
              <div>
                <div className="text-3xl font-black text-white">200</div>
                <div className="text-xs text-wf-gray-500">lbs</div>
              </div>
              <span className="text-xl text-wf-gray-600">×</span>
              <div>
                <div className="text-3xl font-black text-wf-red">10</div>
                <div className="text-xs text-wf-gray-500">reps</div>
              </div>
            </div>
            <button
              onClick={() => setVoiceText(voiceText ? '' : '"200 pounds, 10 reps"')}
              className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-all active:scale-90 ${voiceText ? 'bg-wf-red animate-pulse' : 'bg-white/10 border border-white/20'}`}
            >
              <svg className={`w-7 h-7 ${voiceText ? 'text-white' : 'text-wf-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
            {voiceText && <p className="text-sm text-wf-gray-400 mt-3 italic">{voiceText}</p>}
            <p className="text-[10px] text-wf-gray-600 mt-2">Tap mic, say weight and reps</p>
          </div>
        </div>

      </div>
    </div>
  );
}
