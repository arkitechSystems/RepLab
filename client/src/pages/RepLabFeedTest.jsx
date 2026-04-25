import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVideoPlayer } from '../context/VideoPlayerContext';
import { api } from '../api';

// ---------------------------------------------------------------------------
// RepLab Feed — public fire hose template.
//
// Content sources:
//   - YouTube: 5 creators, video metadata pulled from each channel's public RSS
//     feed (https://www.youtube.com/feeds/videos.xml?channel_id=...). Snapshot
//     as of 2026-04-23. To refresh, re-pull the RSS and replace YT_VIDEOS.
//     Durations are unavailable via RSS — the YouTube Data API (videos.list
//     with part=contentDetails) is needed to fill those in.
//   - Articles: pulled from BarBend and Outlift RSS. T-Nation's editorial
//     site is sunset (domain is forum-only now) and Stronger By Science
//     blocks unauthenticated fetches via Cloudflare — both need server-side
//     integration to source fresh content. Good replacement candidates:
//     Menno Henselmans, Juggernaut Training Systems, RP blog.
//   - User activity: live from /sessions and /pbs for the logged-in user.
// ---------------------------------------------------------------------------

const REACTIONS = [
  { key: 'fire',  emoji: '🔥', label: 'Fire' },
  { key: 'flex',  emoji: '💪', label: 'Flex' },
  { key: 'hundo', emoji: '💯', label: 'Hundo' },
  { key: 'clap',  emoji: '👏', label: 'Clap' },
];

// Absolute ISO publish dates so "days ago" ages correctly over time.
// Snapshot pulled from each channel's public RSS on 2026-04-23 — the dates
// below are the real publishedAt values, not offsets from snapshot day.
const YT_VIDEOS = [
  {
    videoId: 'EpvoiNFqka0',
    creator: 'Jeff Nippard',
    creatorHandle: '@JeffNippard',
    creatorColor: '#0ea5e9',
    title: 'How I Cured My Body Dysmorphia',
    publishedAt: '2026-02-26T00:00:00Z',
    views: '4.5M',
  },
  {
    videoId: 'cbUazHu7Pp8',
    creator: 'Renaissance Periodization',
    creatorHandle: '@RenaissancePeriodization',
    creatorColor: '#8b5cf6',
    title: 'What Dr. Mike Takes Every Morning',
    publishedAt: '2026-04-23T00:00:00Z',
    views: '797',
  },
  {
    videoId: 'QtVvhEeHKcI',
    creator: 'Athlean-X',
    creatorHandle: '@athleanx',
    creatorColor: '#dc2626',
    title: 'How to Lose Stubborn Belly Fat Much Faster (NO, SERIOUSLY!)',
    publishedAt: '2026-04-19T00:00:00Z',
    views: '189K',
  },
  {
    videoId: 'JWm_WhRtFjw',
    creator: 'Greg Doucette',
    creatorHandle: '@GregDoucette',
    creatorColor: '#f59e0b',
    title: 'Retatutride Wrecked Him',
    publishedAt: '2026-04-23T00:00:00Z',
    views: '2K',
  },
  {
    videoId: 'YSuFZNmf1iw',
    creator: 'Team 3DMJ (Eric Helms)',
    creatorHandle: '@Team3DMJ',
    creatorColor: '#22c55e',
    title: '3DMJ Podcast #306: How Much Does Food Quality Matter?',
    publishedAt: '2026-04-16T00:00:00Z',
    views: '2.7K',
  },
];

// Articles use absolute publishedAt too. Timestamp hidden when > 30 days old
// (those sources publish slowly; "1y ago" chips make the feed look broken).
const ARTICLES = [
  {
    source: 'BarBend',
    sourceColor: '#ef4444',
    title: 'Best Vegan Creatine (2026): Plant-Based Picks for Every Athlete',
    url: 'https://barbend.com/best-vegan-creatine/',
    excerpt: 'Creatine is one of the most-studied, most effective supplements for muscle growth known to mankind. The supplement is naturally created in the body from specific amino acids and aids ATP production for intense muscle contractions.',
    publishedAt: '2025-09-05T00:00:00Z',
    readTime: '6 min',
  },
  {
    source: 'Outlift',
    sourceColor: '#8b5cf6',
    title: 'Is DOMS a Sign of Muscle Growth?',
    url: 'https://outlift.com/how-muscle-soreness-affects-muscle-growth/',
    excerpt: 'Most people think delayed onset muscle soreness (DOMS) is a sign of muscle growth. The idea is that if you train a muscle hard enough to make it sore, then you\'ve trained it hard enough to stimulate muscle growth.',
    publishedAt: '2025-04-10T00:00:00Z',
    readTime: '7 min',
  },
];

// ---------------------------------------------------------------------------

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

function initialsFrom(username, email) {
  const src = (username || email || '?').toString();
  return src.slice(0, 2).toUpperCase();
}

// Canonicalize article URLs so the same piece across protocol/www/trailing-slash
// variants produces one stable item_id. Used for the `art-<key>` ID scheme.
function canonicalizeUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.host.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return raw;
  }
}

const EMPTY_REACTIONS = { fire: 0, flex: 0, hundo: 0, clap: 0 };

// ---------------------------------------------------------------------------

export default function RepLabFeedTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [userReactions, setUserReactions] = useState({}); // { [itemId]: reactionKey }
  const [reactionCounts, setReactionCounts] = useState({}); // { [itemId]: { fire, flex, hundo, clap } }
  const [sessions, setSessions] = useState([]);
  const [pbs, setPbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { play: playVideo } = useVideoPlayer();

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api('/sessions', { signal: controller.signal }).catch(() => []),
      api('/pbs',      { signal: controller.signal }).catch(() => []),
    ]).then(([s, p]) => {
      setSessions(Array.isArray(s) ? s : []);
      setPbs(Array.isArray(p) ? p : []);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const feed = useMemo(() => {
    const now = new Date();
    const author = user?.username || user?.email || 'You';
    const initials = initialsFrom(user?.username, user?.email);
    const photoUrl = user?.photoUrl || null;

    // `/pbs` returns one row per (exercise, weight) pair — so a user with
    // multiple bench PRs over time yields several rows for Bench Press.
    // We dedupe by keeping only the most-recent PR per exercise, and compute
    // a delta against the previous-highest weight on that same exercise.
    const byExercise = new Map();
    for (const pb of pbs) {
      const key = pb.exerciseName;
      const list = byExercise.get(key) || [];
      list.push(pb);
      byExercise.set(key, list);
    }

    const prItems = [...byExercise.entries()]
      .map(([exerciseName, rows]) => {
        const sorted = rows.slice().sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt));
        const latest = sorted[0];
        const previousBest = rows
          .filter((r) => r.id !== latest.id && r.bestWeight < latest.bestWeight)
          .reduce((max, r) => (!max || r.bestWeight > max.bestWeight ? r : max), null);
        const delta = previousBest ? latest.bestWeight - previousBest.bestWeight : null;
        return { latest, previousBest, delta };
      })
      .sort((a, b) => new Date(b.latest.achievedAt) - new Date(a.latest.achievedAt))
      .slice(0, 6)
      .map(({ latest, previousBest, delta }) => ({
        id: `pr-${latest.id}`,
        kind: 'pr',
        bucket: 'community',
        sortDate: new Date(latest.achievedAt),
        author,
        initials,
        photoUrl,
        timeAgo: formatTimeAgo(daysBetween(latest.achievedAt, now)),
        exercise: latest.exerciseName,
        weight: latest.bestWeight,
        reps: latest.bestReps,
        previousWeight: previousBest?.bestWeight ?? null,
        previousReps:   previousBest?.bestReps ?? null,
        delta,
      }));

    const workoutItems = sessions
      .filter((s) => s.completed)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
      .map((s) => ({
        id: `wk-${s.id}`,
        kind: 'workout',
        bucket: 'community',
        sortDate: new Date(s.date),
        author,
        initials,
        photoUrl,
        timeAgo: formatTimeAgo(daysBetween(s.date, now)),
        workoutName: s.templateName || 'Workout',
        totalVolume: s.totalVolume || 0,
        exerciseCount: s.exerciseCount || 0,
      }));

    const ytItems = YT_VIDEOS.map((v) => {
      const sortDate = new Date(v.publishedAt);
      return {
        id: `yt-${v.videoId}`,
        kind: 'youtube',
        bucket: 'youtube',
        sortDate,
        timeAgo: formatTimeAgo(daysBetween(v.publishedAt, now)),
        ...v,
      };
    });

    const articleItems = ARTICLES.map((a) => {
      const sortDate = new Date(a.publishedAt);
      const days = daysBetween(a.publishedAt, now);
      return {
        id: `art-${canonicalizeUrl(a.url)}`,
        kind: 'article',
        bucket: 'article',
        sortDate,
        timeAgo: days <= 30 ? formatTimeAgo(days) : null,
        ...a,
      };
    });

    return [...prItems, ...workoutItems, ...ytItems, ...articleItems]
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [sessions, pbs, user]);

  // Batch-fetch persisted reactions once the feed is built. Depends on the
  // joined ID string so we only re-fetch if the item set actually changes.
  const feedIdsKey = useMemo(() => feed.map((i) => i.id).join(','), [feed]);
  useEffect(() => {
    if (!feedIdsKey) return;
    const controller = new AbortController();
    api(`/feed/reactions?ids=${encodeURIComponent(feedIdsKey)}`, { signal: controller.signal })
      .then((res) => {
        setReactionCounts(res?.aggregates || {});
        setUserReactions(res?.mine || {});
      })
      .catch(() => {});
    return () => controller.abort();
  }, [feedIdsKey]);

  // Optimistic toggle: flip local state first, then PUT. Roll back on failure
  // so a dropped request doesn't leave the UI lying to the user.
  const toggleReaction = async (itemId, reactionKey) => {
    const prev = userReactions[itemId] || null;
    const next = prev === reactionKey ? null : reactionKey;

    setUserReactions((r) => ({ ...r, [itemId]: next }));
    setReactionCounts((c) => {
      const curr = { ...EMPTY_REACTIONS, ...(c[itemId] || {}) };
      if (prev) curr[prev] = Math.max(0, curr[prev] - 1);
      if (next) curr[next] = curr[next] + 1;
      return { ...c, [itemId]: curr };
    });

    try {
      await api('/feed/reactions', {
        method: 'PUT',
        body: JSON.stringify({ itemId, reaction: next }),
      });
    } catch {
      // Roll back
      setUserReactions((r) => ({ ...r, [itemId]: prev }));
      setReactionCounts((c) => {
        const curr = { ...EMPTY_REACTIONS, ...(c[itemId] || {}) };
        if (next) curr[next] = Math.max(0, curr[next] - 1);
        if (prev) curr[prev] = curr[prev] + 1;
        return { ...c, [itemId]: curr };
      });
    }
  };

  const visible = feed.filter((item) => filter === 'all' || item.bucket === filter);

  return (
    <div className="min-h-screen bg-black">
      <div className="px-4 pt-6 pb-24 max-w-[480px] mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/test')}
          className="flex items-center gap-1 text-[11px] uppercase font-bold active:opacity-70 mb-6"
          style={{ color: 'rgba(239,68,68,0.9)', letterSpacing: '0.2em' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        {/* Header + filter — sticky so both remain visible while scrolling.
            Uses -mx-4/px-4 so the background bleeds full-width of the
            narrow content column and the blur covers content behind it. */}
        <div className="sticky top-0 z-20 -mx-4 px-4 pt-1 pb-3 bg-black/85 backdrop-blur-md border-b border-white/5">
          <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>The Feed</p>
          <h1 className="text-3xl font-black text-white tracking-tight mb-3" style={{ fontFamily: 'system-ui' }}>REPLAB</h1>

          {/* Source filter chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {[
              { key: 'all',       label: 'All' },
              { key: 'community', label: 'Community' },
              { key: 'youtube',   label: 'YouTube' },
              { key: 'article',   label: 'Articles' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="shrink-0 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-full transition-all active:scale-95"
                style={{
                  background: filter === f.key ? '#ef4444' : 'rgba(255,255,255,0.06)',
                  color: filter === f.key ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: filter === f.key ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                  letterSpacing: '0.15em',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-white/40 font-light mt-3 mb-5 leading-relaxed">
          Community + fitness news. Public fire hose of PRs, workouts, creators, and articles.
        </p>

        {/* Feed */}
        {loading ? (
          <p className="text-[12px] text-white/40 font-light py-8 text-center">Loading your activity…</p>
        ) : (() => {
          // User-activity items (PRs and completed workouts) render as a
          // see-through vertical timeline at the top — matches Brainstorm
          // demo #22. Everything else (YouTube creators, articles) stays as
          // a card below.
          // Newest first across all users — when the feed eventually pulls
          // activity from multiple users, items will interleave by recency.
          const userItems = visible
            .filter((it) => it.kind === 'pr' || it.kind === 'workout')
            .slice()
            .sort((a, b) => (b.sortDate?.getTime?.() ?? 0) - (a.sortDate?.getTime?.() ?? 0));
          const otherItems = visible.filter((it) => it.kind !== 'pr' && it.kind !== 'workout');

          if (visible.length === 0) {
            return <p className="text-[12px] text-white/40 font-light py-8 text-center">Nothing here yet.</p>;
          }

          return (
            <div className="space-y-6">
              {userItems.length > 0 && <UserActivityTimeline items={userItems} />}
              {otherItems.length > 0 && (
                <div className="space-y-3">
                  {otherItems.map((item) => (
                    <FeedCard
                      key={item.id}
                      item={item}
                      userReaction={userReactions[item.id]}
                      counts={reactionCounts[item.id] || EMPTY_REACTIONS}
                      onReact={(rk) => toggleReaction(item.id, rk)}
                      onPlayVideo={playVideo}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

// Vertical activity timeline for the user's own PRs + completed workouts.
// Matches Brainstorm demo #22: vertical line, colored dots, see-through
// (no card surface) so the page background shows through.
function UserActivityTimeline({ items }) {
  if (!items || items.length === 0) return null;
  const formatVolume = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
  return (
    <div>
      <p className="text-[10px] uppercase font-bold mb-4" style={{ letterSpacing: '0.25em', color: 'rgba(239,68,68,0.7)' }}>
        User Activity
      </p>
      <div className="relative pl-6">
        {/* Continuous vertical line tying the entries together */}
        <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="space-y-5">
          {items.map((item) => {
            const isPR = item.kind === 'pr';
            const dotColor = isPR ? '#ef4444' : '#22c55e';
            return (
              <div key={item.id} className="relative">
                {/* Glowing dot on the line */}
                <div
                  className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full"
                  style={{ background: dotColor, boxShadow: `0 0 10px ${dotColor}88` }}
                />
                {/* Top row: time-ago + author (right-aligned). Author shown so
                    multi-user feeds make it obvious whose activity each entry is. */}
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
                      <span className="text-white font-semibold">{item.weight}</span> lb × {item.reps}
                      {item.delta > 0 && (
                        <span style={{ color: '#22c55e', marginLeft: 8, fontWeight: 700 }}>+{item.delta} lb</span>
                      )}
                    </p>
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeedCard({ item, userReaction, counts, onReact, onPlayVideo }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #1a1a1a 0%, #0f0f0f 100%)',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {item.kind === 'pr'      && <PrBody item={item} />}
      {item.kind === 'youtube' && <YouTubeBody item={item} onPlay={onPlayVideo} />}
      {item.kind === 'workout' && <WorkoutBody item={item} />}
      {item.kind === 'article' && <ArticleBody item={item} />}

      <ReactionBar userReaction={userReaction} counts={counts} onReact={onReact} />
    </div>
  );
}

function SourceBadge({ label, color }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-sm"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        letterSpacing: '0.15em',
      }}
    >
      {label}
    </span>
  );
}

function Avatar({ initials, photoUrl, size = 36 }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = photoUrl && !broken;
  return (
    <div
      className="shrink-0 flex items-center justify-center font-black text-white text-[13px] overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: showPhoto ? '#1a1a1a' : 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function CardHeader({ left, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">{left}</div>
      <span className="text-[10px] text-white/35 font-light">{right}</span>
    </div>
  );
}

function PrBody({ item }) {
  return (
    <div className="p-4">
      <CardHeader
        left={
          <>
            <Avatar initials={item.initials} photoUrl={item.photoUrl} />
            <div>
              <p className="text-[13px] text-white font-bold leading-tight">{item.author}</p>
              <p className="text-[10px] text-white/40 font-light">hit a new PR</p>
            </div>
            <SourceBadge label="PR" color="#ef4444" />
          </>
        }
        right={item.timeAgo}
      />
      <div
        className="relative overflow-hidden p-4 mt-1"
        style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.02) 100%)',
          borderRadius: '3px',
          border: '1px solid rgba(239,68,68,0.2)',
        }}
      >
        <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider mb-1" style={{ letterSpacing: '0.2em' }}>
          {item.exercise}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-white tracking-tight">{item.weight}</span>
          <span className="text-sm text-white/60 font-light">lb × {item.reps}</span>
          {item.delta > 0 && (
            <span className="ml-auto text-[11px] font-bold" style={{ color: '#22c55e' }}>
              +{item.delta} lb
            </span>
          )}
        </div>
        {item.previousWeight != null && (
          <p className="text-[10px] text-white/35 font-light mt-1">
            prev: {item.previousWeight} lb × {item.previousReps}
          </p>
        )}
      </div>
    </div>
  );
}

function YouTubeBody({ item, onPlay }) {
  const thumb = `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
  const handlePlay = () => onPlay?.({ videoId: item.videoId, title: item.title, creator: item.creator });
  return (
    <button type="button" onClick={handlePlay} className="block w-full text-left">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9', background: '#000' }}>
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)' }} />
        <div className="absolute top-3 left-3">
          <SourceBadge label="YouTube" color="#ef4444" />
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[10px] uppercase font-light mb-0.5" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.2em' }}>
            {item.creator}
          </p>
          <h3 className="text-[15px] font-black text-white leading-tight tracking-tight line-clamp-2">
            {item.title}
          </h3>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.9)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
          >
            <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="px-4 pt-3">
        <p className="text-[10px] text-white/35 font-light">
          {item.views} views · {item.timeAgo}
        </p>
      </div>
    </button>
  );
}

function WorkoutBody({ item }) {
  const hasStats = item.totalVolume > 0 || item.exerciseCount > 0;
  const volumeDisplay =
    item.totalVolume >= 1000
      ? `${(item.totalVolume / 1000).toFixed(1)}k`
      : String(Math.round(item.totalVolume));
  return (
    <div className="p-4">
      <CardHeader
        left={
          <>
            <Avatar initials={item.initials} photoUrl={item.photoUrl} />
            <div>
              <p className="text-[13px] text-white font-bold leading-tight">{item.author}</p>
              <p className="text-[10px] text-white/40 font-light">completed a workout</p>
            </div>
          </>
        }
        right={item.timeAgo}
      />
      <p className="text-[16px] font-black text-white tracking-tight mb-3">{item.workoutName}</p>
      {hasStats && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Volume" value={volumeDisplay} unit="lb" />
          <Stat label="Lifts"  value={item.exerciseCount} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div
      className="px-2 py-2"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '3px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <p className="text-[9px] uppercase font-bold text-white/40 tracking-wider mb-0.5" style={{ letterSpacing: '0.15em' }}>
        {label}
      </p>
      <p className="text-[15px] font-black text-white tracking-tight">
        {value}
        {unit && <span className="text-[10px] text-white/40 font-light ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

function ArticleBody({ item }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="block p-4">
      <div className="flex items-center justify-between mb-3">
        <SourceBadge label={item.source} color={item.sourceColor} />
        {item.timeAgo && (
          <span className="text-[10px] text-white/35 font-light">{item.timeAgo}</span>
        )}
      </div>
      <h3 className="text-[17px] font-black text-white tracking-tight leading-tight mb-2">
        {item.title}
      </h3>
      <p className="text-[12px] text-white/55 font-light leading-relaxed line-clamp-3">
        {item.excerpt}
      </p>
      <p className="text-[10px] text-white/35 font-light mt-3">{item.readTime} read</p>
    </a>
  );
}

// Reaction model: one reaction per user per item, switchable. Tapping the
// same reaction again clears it; tapping a different one replaces. Aggregate
// "N reactions" is hidden until there's at least one, so fresh items don't
// read as a ghost town.
function ReactionBar({ userReaction, counts, onReact }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div
      className="flex items-center gap-1 px-2"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}
    >
      {REACTIONS.map((r) => {
        const count = counts[r.key] || 0;
        const active = userReaction === r.key;
        return (
          <button
            key={r.key}
            type="button"
            aria-label={`${r.label}${count ? ` (${count})` : ''}`}
            aria-pressed={active}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact(r.key); }}
            className="flex items-center justify-center gap-1.5 px-3 rounded-full transition-all active:scale-90"
            style={{
              minHeight: 44,
              minWidth: 44,
              background: active ? 'rgba(239,68,68,0.15)' : 'transparent',
              border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
            }}
          >
            <span className="text-[15px] leading-none">{r.emoji}</span>
            {count > 0 && (
              <span
                className="text-[11px] font-bold leading-none"
                style={{ color: active ? '#ef4444' : 'rgba(255,255,255,0.6)' }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
      {total > 0 && (
        <span className="ml-auto text-[10px] text-white/30 font-light pr-1">{total} reactions</span>
      )}
    </div>
  );
}
