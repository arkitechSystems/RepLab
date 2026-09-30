// Unit tests for communityLikeNotifier.js — push text and the grouping /
// opt-out rules. The pool is faked by matching on SQL fragments, so these
// never touch a real database.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  optIn: true,          // owner's notify_community_likes
  pushedRecently: false,
  pending: [],          // rows returned by the flush's pending-likers query
  flushItems: [],       // rows returned by flushPendingLikePushes' item scan
  updates: [],          // [sql, params] for every notice UPDATE
};

function fakeQuery(sql, params) {
  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql) || sql.includes('pg_advisory_xact_lock')) {
    return { rows: [] };
  }
  if (sql.includes('SELECT notify_community_likes')) {
    return { rows: [{ notify_community_likes: state.optIn }] };
  }
  if (sql.includes('SELECT username')) {
    return { rows: [{ username: params[0] === 5 ? 'sam' : `user${params[0]}`, account_id: null }] };
  }
  if (sql.includes('UPDATE community_like_notices')) {
    state.updates.push([sql, params]);
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes('AS still_liked')) {
    return { rows: state.pending };
  }
  if (sql.includes('GROUP BY n.item_type')) {
    return { rows: state.flushItems };
  }
  if (sql.includes('pushed = TRUE') && sql.includes('LIMIT 1')) {
    return { rows: state.pushedRecently ? [{ '?column?': 1 }] : [] };
  }
  throw new Error(`Unexpected SQL in test: ${sql}`);
}

vi.mock('../dbPool.js', () => {
  const client = { query: vi.fn(async (sql, params) => fakeQuery(sql, params)), release: vi.fn() };
  return {
    default: {
      query: vi.fn(async (sql, params) => fakeQuery(sql, params)),
      connect: vi.fn(async () => client),
      on: vi.fn(),
    },
  };
});

vi.mock('../db.js', () => ({
  default: { getCommunityItem: vi.fn() },
}));

vi.mock('../routes/push.js', () => ({
  sendPushToUser: vi.fn().mockResolvedValue({ sent: 1 }),
}));

const { notifyCommunityLike, flushPendingLikePushes, buildLikePush, describeLikedItem } =
  await import('../communityLikeNotifier.js');
const { sendPushToUser } = await import('../routes/push.js');
const { default: db } = await import('../db.js');

const PR_ITEM = { type: 'pr', id: 42, ownerId: 2, exercise: 'Bench Press', weight: 225, reps: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  state.optIn = true;
  state.pushedRecently = false;
  state.pending = [];
  state.flushItems = [];
  state.updates = [];
});

describe('like push text', () => {
  it('describes each activity type the way the feed does', () => {
    expect(describeLikedItem(PR_ITEM)).toBe('your Bench Press PR (225 lbs)');
    expect(describeLikedItem({ type: 'pr', exercise: 'Pull-Ups', weight: 0, reps: 12 }))
      .toBe('your Pull-Ups PR (BW × 12)');
    expect(describeLikedItem({ type: 'workout', workoutName: 'Push Day' }))
      .toBe('your completed workout: Push Day');
    expect(describeLikedItem({ type: 'program', programName: "Will's Hypertrophy Program" }))
      .toBe("that you started Will's Hypertrophy Program");
    expect(describeLikedItem({ type: 'custom', workoutName: 'Leg Blaster' }))
      .toBe('your custom workout: Leg Blaster');
  });

  it('groups later likers into "and N others" and deep-links to the item', () => {
    const single = buildLikePush('sam', 0, PR_ITEM);
    expect(single.body).toBe('sam applauded your Bench Press PR (225 lbs)');
    expect(single.data).toEqual({ kind: 'community_like', itemKey: 'pr-42' });

    expect(buildLikePush('sam', 1, PR_ITEM).body).toBe('sam and 1 other applauded your Bench Press PR (225 lbs)');
    expect(buildLikePush('sam', 3, PR_ITEM).body).toBe('sam and 3 others applauded your Bench Press PR (225 lbs)');
  });
});

describe('notifyCommunityLike', () => {
  it('pushes the first like right away', async () => {
    await notifyCommunityLike(5, PR_ITEM);

    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledWith(
      2,
      '👏 New applause',
      'sam applauded your Bench Press PR (225 lbs)',
      { kind: 'community_like', itemKey: 'pr-42' }
    );
    // Marked handled, and as an actual push (starts the grouping window).
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0][1]).toEqual([5, 'pr', 42, true]);
  });

  it('holds likes that arrive within the window for the batched follow-up', async () => {
    state.pushedRecently = true;

    await notifyCommunityLike(5, PR_ITEM);

    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0); // still pending
  });

  it('sends nothing when the owner turned "Likes on my activity" off', async () => {
    state.optIn = false;

    await notifyCommunityLike(5, PR_ITEM);

    expect(sendPushToUser).not.toHaveBeenCalled();
    // Marked handled without a push, so turning the setting back on later
    // doesn't flush old likes.
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0][1]).toEqual([5, 'pr', 42, false]);
  });
});

describe('flushPendingLikePushes', () => {
  const recent = new Date();

  it('sends one grouped push for likers who still like the item', async () => {
    state.flushItems = [{ item_type: 'pr', item_id: 42 }];
    state.pending = [
      { user_id: 5, owner_user_id: 2, created_at: recent, still_liked: true },
      { user_id: 6, owner_user_id: 2, created_at: recent, still_liked: true },
      { user_id: 7, owner_user_id: 2, created_at: recent, still_liked: false }, // unliked
      { user_id: 8, owner_user_id: 2, created_at: recent, still_liked: true },
    ];
    db.getCommunityItem.mockResolvedValue(PR_ITEM);

    await flushPendingLikePushes();

    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledWith(
      2,
      '👏 3 new applause',
      'sam and 2 others applauded your Bench Press PR (225 lbs)',
      { kind: 'community_like', itemKey: 'pr-42' }
    );
    // Every pending row is closed out; only still-liked ones count as pushed.
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0][1]).toEqual(['pr', 42, [5, 6, 8]]);
  });

  it('drops pending likes silently when the owner opted out', async () => {
    state.optIn = false;
    state.flushItems = [{ item_type: 'pr', item_id: 42 }];
    state.pending = [{ user_id: 5, owner_user_id: 2, created_at: recent, still_liked: true }];

    await flushPendingLikePushes();

    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(state.updates[0][1]).toEqual(['pr', 42, []]);
  });

  it('drops pending likes when the activity is no longer shared', async () => {
    state.flushItems = [{ item_type: 'pr', item_id: 42 }];
    state.pending = [{ user_id: 5, owner_user_id: 2, created_at: recent, still_liked: true }];
    db.getCommunityItem.mockResolvedValue(null);

    await flushPendingLikePushes();

    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(state.updates[0][1]).toEqual(['pr', 42, []]);
  });
});
