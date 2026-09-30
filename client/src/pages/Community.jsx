import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';
import { api } from '../api';
import { track } from '../utils/analytics';
import { lightTap } from '../utils/haptics';

function formatTimeAgo(daysAgo) {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return '1d ago';
  if (daysAgo < 7)   return `${daysAgo}d ago`;
  if (daysAgo < 30)  return `${Math.floor(daysAgo / 7)}w ago`;
  if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
  return `${Math.floor(daysAgo / 365)}y ago`;
}

function daysBetween(dateStr, now = new Date()) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const ms = now - d;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function initialsFrom(name) {
  const src = (name || '?').toString();
  return src.slice(0, 2).toUpperCase();
}

function Avatar({ initials, photoUrl, size = 18 }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = photoUrl && !broken;
  return (
    <div
      className="shrink-0 flex items-center justify-center font-black text-white overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.55)),
        borderRadius: '50%',
        background: showPhoto ? '#1a1a1a' : 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      {showPhoto ? (
        <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </div>
  );
}

// Clapping hands in the app's line-icon style: two palms leaning into each
// other plus three motion ticks. Tinted with currentColor (red when
// applauded). The inner <g>s carry the clap animation; the outer ones hold
// each palm's resting tilt so the CSS transform doesn't override it.
function ApplauseIcon({ applauded }) {
  return (
    <svg
      className="w-4 h-4 shrink-0 overflow-visible"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="rotate(-16 10 14)">
        <g className="replab-clap-l">
          <rect x="5.5" y="7" width="7" height="13.5" rx="3.5" fill={applauded ? 'currentColor' : 'none'} fillOpacity={0.22} />
        </g>
      </g>
      <g transform="rotate(16 14 14)">
        <g className="replab-clap-r">
          <rect x="11.5" y="7" width="7" height="13.5" rx="3.5" fill={applauded ? 'currentColor' : 'none'} fillOpacity={0.22} />
        </g>
      </g>
      <path d="M12 1.8v2M7.9 2.9l1 1.6M16.1 2.9l-1 1.6" />
    </svg>
  );
}

// Clap (palms squeeze in and pop back) + a small spark burst, ~500ms, played
// only when applauding — un-applauding just un-highlights. Skipped entirely
// under prefers-reduced-motion.
const APPLAUSE_CSS = `
  .replab-clap-l, .replab-clap-r { transform-box: fill-box; transform-origin: 50% 100%; }
  .replab-clapping .replab-clap-l { animation: replab-clap-l 500ms ease-out; }
  .replab-clapping .replab-clap-r { animation: replab-clap-r 500ms ease-out; }
  @keyframes replab-clap-l { 0% { transform: rotate(0); } 30% { transform: rotate(12deg) scale(0.92); } 60% { transform: rotate(-3deg) scale(1.08); } 100% { transform: rotate(0) scale(1); } }
  @keyframes replab-clap-r { 0% { transform: rotate(0); } 30% { transform: rotate(-12deg) scale(0.92); } 60% { transform: rotate(3deg) scale(1.08); } 100% { transform: rotate(0) scale(1); } }
  .replab-spark { position: absolute; left: 50%; top: 50%; width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: #ef4444; opacity: 0; pointer-events: none; animation: replab-spark 500ms ease-out 120ms forwards; }
  @keyframes replab-spark { 0% { opacity: 1; transform: translate(0, 0) scale(1); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.4); } }
  @media (prefers-reduced-motion: reduce) {
    .replab-clapping .replab-clap-l, .replab-clapping .replab-clap-r { animation: none; }
    .replab-spark { display: none; }
  }
`;

// Six sparks around the icon, as (dx, dy) offsets in px.
const SPARKS = [[0, -13], [11, -7], [11, 7], [0, 13], [-11, 7], [-11, -7]];

// Applause control for one feed item. Your own activity shows the count only
// (no button), and nothing at all until someone has applauded it.
function ApplauseButton({ item, onToggle }) {
  // Bumped on each applaud so the clap/spark elements remount and replay.
  const [burst, setBurst] = useState(0);
  const count = item.likeCount || 0;
  if (item.isMine) {
    if (count === 0) return null;
    return (
      <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'rgba(239,68,68,0.8)' }}>
        <ApplauseIcon applauded />
        <span>{count}</span>
      </div>
    );
  }
  const applauded = !!item.likedByMe;
  return (
    <button
      type="button"
      onClick={() => {
        lightTap();
        if (!applauded) setBurst((b) => b + 1);
        onToggle(item);
      }}
      aria-pressed={applauded}
      aria-label={applauded ? 'Remove applause' : 'Applaud'}
      className="flex items-center gap-1 text-[11px] font-semibold -my-1 py-1 pr-1 active:scale-95 transition-transform"
      style={{ color: applauded ? '#ef4444' : 'rgba(255,255,255,0.4)' }}
    >
      <span key={burst} className={`relative inline-flex ${burst > 0 && applauded ? 'replab-clapping' : ''}`}>
        <ApplauseIcon applauded={applauded} />
        {burst > 0 && applauded && SPARKS.map(([dx, dy]) => (
          <span key={`${dx},${dy}`} className="replab-spark" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` }} />
        ))}
      </span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

function ActivityTicker({ messages }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div
      className="fade-slide-up mb-5"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '2px',
        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ padding: '16px', overflow: 'hidden' }}>
        <p
          className="text-[10px] uppercase font-light mb-2"
          style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.25em' }}
        >
          REPLAB Community
        </p>
        <div style={{ borderBottom: '1px dotted rgba(255,255,255,0.15)', marginBottom: '12px' }} />
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-block', animation: 'prTicker 60s linear infinite', fontSize: '12px' }}>
            {messages.map((msg, i) => (
              <span key={i}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>{msg}</span>
                <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 16px' }}>|</span>
              </span>
            ))}
            {messages.map((msg, i) => (
              <span key={`d-${i}`}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>{msg}</span>
                <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 16px' }}>|</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityTimeline({ items, onToggleLike, highlightId }) {
  if (!items || items.length === 0) {
    return (
      <div>
        <p className="text-[10px] uppercase font-bold mb-4" style={{ letterSpacing: '0.25em', color: 'rgba(239,68,68,0.7)' }}>
          REPLAB Feed
        </p>
        <p className="text-[12px] text-white/40 font-light py-8 text-center">No activity yet — complete a workout, start a program, or hit a PR to kick off the REPLAB feed.</p>
      </div>
    );
  }
  const formatVolume = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
  return (
    <div>
      <p className="text-[10px] uppercase font-bold mb-4" style={{ letterSpacing: '0.25em', color: 'rgba(239,68,68,0.7)' }}>
        REPLAB Feed
      </p>
      <div className="relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="space-y-5">
          {items.map((item) => {
            const isPR = item.kind === 'pr';
            const isProgram = item.kind === 'program';
            const isCustom = item.kind === 'custom';
            const dotColor = isPR ? '#ef4444' : isProgram ? '#3b82f6' : isCustom ? '#a855f7' : '#22c55e';
            return (
              <div
                key={item.id}
                id={`community-item-${item.id}`}
                className="relative transition-colors duration-700 rounded-sm"
                style={highlightId === item.id ? { background: 'rgba(239,68,68,0.10)', boxShadow: '0 0 0 6px rgba(239,68,68,0.10)' } : undefined}
              >
                <div
                  className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full"
                  style={{ background: dotColor, boxShadow: `0 0 10px ${dotColor}88` }}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>
                    {item.timeAgo}
                  </p>
                  {item.author && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Avatar initials={item.initials} photoUrl={item.photoUrl} size={18} />
                      <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.author}</span>
                    </div>
                  )}
                </div>
                {isPR ? (
                  <>
                    <p className="text-[14px] font-bold text-white mt-1">{item.exercise} PR</p>
                    <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {item.weight > 0 ? (
                        <><span className="text-white font-semibold">{item.weight}</span> lb</>
                      ) : (
                        <span className="text-white font-semibold">BW</span>
                      )} × {item.reps}
                      {item.delta > 0 && (
                        <span style={{ color: '#22c55e', marginLeft: 8, fontWeight: 700 }}>+{item.delta} lb</span>
                      )}
                    </p>
                  </>
                ) : isProgram ? (
                  <>
                    <p className="text-[14px] font-bold text-white mt-1">Started {item.programName}</p>
                    <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>New program</p>
                  </>
                ) : isCustom ? (
                  <>
                    <p className="text-[14px] font-bold text-white mt-1">Created {item.workoutName}</p>
                    <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Custom workout</p>
                  </>
                ) : (
                  <>
                    <p className="text-[14px] font-bold text-white mt-1">{item.workoutName}</p>
                    {(item.totalVolume > 0 || item.exerciseCount > 0) && (
                      <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {item.totalVolume > 0 && (
                          <>
                            <span className="text-white font-semibold">{formatVolume(item.totalVolume)}</span> lb volume
                          </>
                        )}
                        {item.totalVolume > 0 && item.exerciseCount > 0 && (
                          <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 6px' }}>·</span>
                        )}
                        {item.exerciseCount > 0 && (
                          <>
                            <span className="text-white font-semibold">{item.exerciseCount}</span> {item.exerciseCount === 1 ? 'lift' : 'lifts'}
                          </>
                        )}
                      </p>
                    )}
                  </>
                )}
                <div className="mt-2">
                  <ApplauseButton item={item} onToggle={onToggleLike} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Community() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [feed, setFeed] = useState({ items: [], authors: {} });
  const [loading, setLoading] = useState(true);
  // Item a like push deep-linked to (/community?item=pr-42), highlighted briefly.
  const [highlightId, setHighlightId] = useState(null);
  // Items with a like/unlike request in flight — ignore taps until it settles.
  const pendingLikes = useRef(new Set());

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const controller = new AbortController();
    api('/community/feed', { signal: controller.signal })
      .catch(() => null)
      .then((res) => {
        if (controller.signal.aborted) return;
        setFeed({
          items: Array.isArray(res?.items) ? res.items : [],
          authors: res?.authors && typeof res.authors === 'object' ? res.authors : {},
        });
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Scroll to and flash the item a like notification pointed at.
  const targetItem = searchParams.get('item');
  useEffect(() => {
    if (loading || !targetItem) return;
    const el = document.getElementById(`community-item-${targetItem}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(targetItem);
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [loading, targetItem]);

  const updateItem = (id, patch) => {
    setFeed((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  };

  // Optimistic like/unlike; rolls back if the request fails. The server's
  // count wins once it answers.
  async function toggleLike(item) {
    if (item.isMine || pendingLikes.current.has(item.id)) return;
    pendingLikes.current.add(item.id);
    const wasLiked = !!item.likedByMe;
    const prevCount = item.likeCount || 0;
    updateItem(item.id, { likedByMe: !wasLiked, likeCount: Math.max(0, prevCount + (wasLiked ? -1 : 1)) });
    try {
      const res = await api(`/community/likes/${encodeURIComponent(item.id)}`, { method: wasLiked ? 'DELETE' : 'PUT' });
      if (typeof res?.likeCount === 'number') updateItem(item.id, { likeCount: res.likeCount });
      track(wasLiked ? 'community_unlike' : 'community_like', { kind: item.kind });
    } catch {
      updateItem(item.id, { likedByMe: wasLiked, likeCount: prevCount });
    } finally {
      pendingLikes.current.delete(item.id);
    }
  }

  const items = useMemo(() => {
    const now = new Date();
    return feed.items.map((item) => {
      const author = feed.authors[item.userId] || {};
      const name = author.name || 'Lifter';
      // Workouts carry the user-local session day; PRs/program starts a timestamp.
      const when = item.kind === 'workout' && item.date ? item.date : item.occurredAt;
      return {
        ...item,
        author: name,
        initials: initialsFrom(name),
        photoUrl: author.photoUrl || null,
        timeAgo: formatTimeAgo(daysBetween(when, now)),
      };
    });
  }, [feed]);

  const tickerMessages = useMemo(() => {
    return items.slice(0, 15).map((item) => {
      if (item.kind === 'pr') {
        const delta = item.delta > 0 ? ` (+${item.delta} lb)` : '';
        const load = item.weight > 0 ? `${item.weight} lbs` : 'BW';
        return `${item.author} hit a PR on ${item.exercise} — ${load} × ${item.reps}${delta}`;
      }
      if (item.kind === 'program') {
        return `${item.author} started ${item.programName}`;
      }
      if (item.kind === 'custom') {
        return `${item.author} created ${item.workoutName}`;
      }
      if (item.totalVolume > 0) {
        return `${item.author} completed ${item.workoutName} · ${Math.round(item.totalVolume).toLocaleString()} lbs total volume`;
      }
      return `${item.author} completed ${item.workoutName}`;
    });
  }, [items]);

  return (
    <div className="pb-24">
      <style>{APPLAUSE_CSS}</style>
      <StickyHeader title="COMMUNITY" titleStyle={{ fontSize: '26.4px' }}>
        <button
          onClick={() => navigate(-1)}
          className="text-[11px] uppercase font-bold text-wf-gray-400 active:text-white"
          style={{ letterSpacing: '0.2em' }}
        >
          Back
        </button>
      </StickyHeader>

      <div className="px-4 pb-4">
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Together
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              COMMUNITY
            </h1>
            <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
              Train alongside other lifters. See what they're hitting, share PRs, and stay accountable.
            </p>
          </div>
        </div>

        <ActivityTicker messages={tickerMessages} />

        {loading ? (
          <p className="text-[12px] text-white/40 font-light py-8 text-center">Loading activity…</p>
        ) : (
          <CommunityTimeline items={items} onToggleLike={toggleLike} highlightId={highlightId} />
        )}
      </div>
    </div>
  );
}
