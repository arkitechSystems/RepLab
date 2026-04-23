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

// All uploadedDaysAgo values are relative to 2026-04-23.
const YT_VIDEOS = [
  {
    videoId: 'EpvoiNFqka0',
    creator: 'Jeff Nippard',
    creatorHandle: '@JeffNippard',
    creatorColor: '#0ea5e9',
    title: 'How I Cured My Body Dysmorphia',
    uploadedDaysAgo: 56,
    views: '4.5M',
  },
  {
    videoId: 'cbUazHu7Pp8',
    creator: 'Renaissance Periodization',
    creatorHandle: '@RenaissancePeriodization',
    creatorColor: '#8b5cf6',
    title: 'What Dr. Mike Takes Every Morning',
    uploadedDaysAgo: 0,
    views: '797',
  },
  {
    videoId: 'QtVvhEeHKcI',
    creator: 'Athlean-X',
    creatorHandle: '@athleanx',
    creatorColor: '#dc2626',
    title: 'How to Lose Stubborn Belly Fat Much Faster (NO, SERIOUSLY!)',
    uploadedDaysAgo: 4,
    views: '189K',
  },
  {
    videoId: 'JWm_WhRtFjw',
    creator: 'Greg Doucette',
    creatorHandle: '@GregDoucette',
    creatorColor: '#f59e0b',
    title: 'Retatutride Wrecked Him',
    uploadedDaysAgo: 0,
    views: '2K',
  },
  {
    videoId: 'YSuFZNmf1iw',
    creator: 'Team 3DMJ (Eric Helms)',
    creatorHandle: '@Team3DMJ',
    creatorColor: '#22c55e',
    title: '3DMJ Podcast #306: How Much Does Food Quality Matter?',
    uploadedDaysAgo: 7,
    views: '2.7K',
  },
];

const ARTICLES = [
  {
    source: 'BarBend',
    sourceColor: '#ef4444',
    title: 'Best Vegan Creatine (2026): Plant-Based Picks for Every Athlete',
    url: 'https://barbend.com/best-vegan-creatine/',
    excerpt: 'Creatine is one of the most-studied, most effective supplements for muscle growth known to mankind. The supplement is naturally created in the body from specific amino acids and aids ATP production for intense muscle contractions.',
    daysAgo: 230,
    readTime: '6 min',
  },
  {
    source: 'Outlift',
    sourceColor: '#8b5cf6',
    title: 'Is DOMS a Sign of Muscle Growth?',
    url: 'https://outlift.com/how-muscle-soreness-affects-muscle-growth/',
    excerpt: 'Most people think delayed onset muscle soreness (DOMS) is a sign of muscle growth. The idea is that if you train a muscle hard enough to make it sore, then you\'ve trained it hard enough to stimulate muscle growth.',
    daysAgo: 378,
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

// ---------------------------------------------------------------------------

export default function RepLabFeedTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('firehose');
  const [filter, setFilter] = useState('all');
  const [userReactions, setUserReactions] = useState({});
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

    const prItems = pbs
      .slice()
      .sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt))
      .slice(0, 6)
      .map((pb) => ({
        id: `pr-${pb.id}`,
        kind: 'pr',
        bucket: 'community',
        sortDate: new Date(pb.achievedAt),
        author,
        initials,
        photoUrl,
        timeAgo: formatTimeAgo(daysBetween(pb.achievedAt, now)),
        exercise: pb.exerciseName,
        weight: pb.bestWeight,
        reps: pb.bestReps,
        reactions: { fire: 0, flex: 0, hundo: 0, clap: 0 },
      }));

    const workoutItems = sessions
      .slice()
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
        reactions: { fire: 0, flex: 0, hundo: 0, clap: 0 },
      }));

    const ytItems = YT_VIDEOS.map((v, i) => ({
      id: `yt-${v.videoId}`,
      kind: 'youtube',
      bucket: 'youtube',
      sortDate: new Date(now.getTime() - v.uploadedDaysAgo * 86400000),
      timeAgo: formatTimeAgo(v.uploadedDaysAgo),
      ...v,
      reactions: { fire: 0, flex: 0, hundo: 0, clap: 0 },
    }));

    const articleItems = ARTICLES.map((a) => ({
      id: `art-${a.url}`,
      kind: 'article',
      bucket: 'article',
      sortDate: new Date(now.getTime() - a.daysAgo * 86400000),
      timeAgo: formatTimeAgo(a.daysAgo),
      ...a,
      reactions: { fire: 0, flex: 0, hundo: 0, clap: 0 },
    }));

    return [...prItems, ...workoutItems, ...ytItems, ...articleItems]
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [sessions, pbs, user]);

  const toggleReaction = (itemId, reactionKey) => {
    setUserReactions((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === reactionKey ? null : reactionKey,
    }));
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

        {/* Header */}
        <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>The Feed</p>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1" style={{ fontFamily: 'system-ui' }}>REPLAB</h1>
        <p className="text-[12px] text-white/40 font-light mb-6 leading-relaxed">
          Community + fitness news. Public fire hose of PRs, workouts, creators, and articles.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/10">
          {[
            { key: 'firehose',  label: 'Fire Hose' },
            { key: 'following', label: 'Following' },
            { key: 'foryou',    label: 'For You' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative px-3 py-2.5 text-[11px] uppercase font-bold tracking-wider transition-colors"
              style={{ color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ background: '#ef4444' }} />
              )}
            </button>
          ))}
        </div>

        {/* Source filter chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide -mx-4 px-4">
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

        {/* Feed */}
        {loading ? (
          <p className="text-[12px] text-white/40 font-light py-8 text-center">Loading your activity…</p>
        ) : (
          <div className="space-y-3">
            {visible.length === 0 && (
              <p className="text-[12px] text-white/40 font-light py-8 text-center">Nothing here yet.</p>
            )}
            {visible.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                userReaction={userReactions[item.id]}
                onReact={(rk) => toggleReaction(item.id, rk)}
                onPlayVideo={playVideo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FeedCard({ item, userReaction, onReact, onPlayVideo }) {
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

      <ReactionBar item={item} userReaction={userReaction} onReact={onReact} />
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
        </div>
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
      <p className="text-[16px] font-black text-white tracking-tight">{item.workoutName}</p>
    </div>
  );
}

function ArticleBody({ item }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="block p-4">
      <div className="flex items-center justify-between mb-3">
        <SourceBadge label={item.source} color={item.sourceColor} />
        <span className="text-[10px] text-white/35 font-light">{item.timeAgo}</span>
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

function ReactionBar({ item, userReaction, onReact }) {
  const total = Object.values(item.reactions).reduce((a, b) => a + b, 0) + (userReaction ? 1 : 0);

  return (
    <div
      className="flex items-center gap-1 px-3 py-2"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}
    >
      {REACTIONS.map((r) => {
        const count = item.reactions[r.key] + (userReaction === r.key ? 1 : 0);
        const active = userReaction === r.key;
        return (
          <button
            key={r.key}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact(r.key); }}
            className="flex items-center gap-1 px-2 py-1 rounded-full transition-all active:scale-90"
            style={{
              background: active ? 'rgba(239,68,68,0.15)' : 'transparent',
              border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
            }}
          >
            <span className="text-[14px] leading-none">{r.emoji}</span>
            <span
              className="text-[11px] font-bold leading-none"
              style={{ color: active ? '#ef4444' : 'rgba(255,255,255,0.5)' }}
            >
              {count}
            </span>
          </button>
        );
      })}
      <span className="ml-auto text-[10px] text-white/30 font-light">{total} reactions</span>
    </div>
  );
}
