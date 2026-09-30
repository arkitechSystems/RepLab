// Push notifications for likes on Community feed activity. User-facing copy
// calls a like "applause" (the button is a clapping-hands icon); internal
// names — tables, routes, analytics events — still say "like".
//
// Grouping: the first like on an item pushes to its owner right away. Any
// more likes on that item within WINDOW_MIN of the last push wait in
// community_like_notices (notified_at IS NULL) and go out together as one
// follow-up push ("Sam and 3 others applauded your Bench Press PR") once the
// window has passed. The flush runs on a 1-minute tick, and pending rows
// live in the DB, so a restart delays the follow-up rather than losing it.
//
// A notice row is written only the first time a user likes an item
// (db.likeCommunityItem), and it survives unlike, so re-liking never
// notifies twice. Likes are silently marked handled when the owner has
// "Applause on my activity" off, the item is no longer shared, or the liker
// unliked before the batch went out.
//
// Per-item work runs under a transaction-scoped advisory lock so a like
// arriving mid-flush can't produce a duplicate push. Sends happen after
// commit and never throw to the caller; sendPushToUser no-ops when FCM
// isn't configured.

import pool from './dbPool.js';
import db from './db.js';
import { sendPushToUser } from './routes/push.js';
import { communityItemKey } from './communityItems.js';

const WINDOW_MIN = 15;
const TICK_MS = 60 * 1000;
// Pending likes older than this are dropped instead of sent (e.g. after a
// long outage) — a days-late "applauded your PR" push is just noise.
const STALE_DAYS = 3;

function formatWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return String(w);
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

// What was applauded, phrased to follow "<name> applauded ". Mirrors the feed's
// wording for each item type.
export function describeLikedItem(item) {
  if (item.type === 'pr') {
    const load = item.weight > 0 ? `${formatWeight(item.weight)} lbs` : `BW × ${item.reps}`;
    return `your ${item.exercise} PR (${load})`;
  }
  if (item.type === 'program') return `that you started ${item.programName}`;
  if (item.type === 'custom') return `your custom workout: ${item.workoutName}`;
  return `your completed workout: ${item.workoutName}`;
}

export function buildLikePush(likerName, othersCount, item) {
  const who = othersCount > 0
    ? `${likerName} and ${othersCount} ${othersCount === 1 ? 'other' : 'others'}`
    : likerName;
  const total = othersCount + 1;
  return {
    title: total > 1 ? `👏 ${total} new applause` : '👏 New applause',
    body: `${who} applauded ${describeLikedItem(item)}`,
    data: { kind: 'community_like', itemKey: communityItemKey(item.type, item.id) },
  };
}

// Same public name the feed shows for an author — never an email or legal name.
async function displayName(client, userId) {
  const { rows } = await client.query(
    'SELECT username, account_id FROM users WHERE id = $1',
    [userId]
  );
  const u = rows[0];
  if (!u) return 'Someone';
  return u.username || (u.account_id ? `Lifter #${u.account_id}` : 'A lifter');
}

async function lockItem(client, type, id) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`community_like:${type}:${id}`]);
}

async function ownerWantsLikePushes(client, ownerId) {
  const { rows } = await client.query(
    'SELECT notify_community_likes FROM users WHERE id = $1',
    [ownerId]
  );
  return rows[0]?.notify_community_likes === true;
}

async function pushedRecently(client, type, id) {
  const { rows } = await client.query(
    `SELECT 1 FROM community_like_notices
      WHERE item_type = $1 AND item_id = $2 AND pushed = TRUE
        AND notified_at > NOW() - ($3::int * INTERVAL '1 minute')
      LIMIT 1`,
    [type, id, WINDOW_MIN]
  );
  return rows.length > 0;
}

// Called after a first-time like. `item` is the row from db.getCommunityItem.
export async function notifyCommunityLike(likerId, item) {
  let push = null;
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[community-like] db connect failed:', err.message);
    return;
  }
  try {
    await client.query('BEGIN');
    await lockItem(client, item.type, item.id);
    const markSelf = (pushed) => client.query(
      `UPDATE community_like_notices SET notified_at = NOW(), pushed = $4
        WHERE user_id = $1 AND item_type = $2 AND item_id = $3 AND notified_at IS NULL`,
      [likerId, item.type, item.id, pushed]
    );
    if (!(await ownerWantsLikePushes(client, item.ownerId))) {
      await markSelf(false);
    } else if (!(await pushedRecently(client, item.type, item.id))) {
      await markSelf(true);
      push = buildLikePush(await displayName(client, likerId), 0, item);
    }
    // else: leave pending for the batched follow-up.
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[community-like] notify failed:', err.message);
    return;
  } finally {
    client.release();
  }
  if (push) {
    try {
      await sendPushToUser(item.ownerId, push.title, push.body, push.data);
    } catch (err) {
      console.error('[community-like] send failed:', err.message);
    }
  }
}

// Sends (or drops) the batched follow-up for one item whose window has passed.
async function flushItem(type, id) {
  let push = null;
  let ownerId = null;
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[community-like] db connect failed:', err.message);
    return;
  }
  try {
    await client.query('BEGIN');
    await lockItem(client, type, id);
    if (await pushedRecently(client, type, id)) {
      await client.query('COMMIT');
      return;
    }
    // Pending likers who still like it, newest first.
    const { rows: pending } = await client.query(
      `SELECT n.user_id, n.owner_user_id, n.created_at,
              EXISTS (SELECT 1 FROM community_likes cl
                       WHERE cl.user_id = n.user_id AND cl.item_type = n.item_type
                         AND cl.item_id = n.item_id) AS still_liked
         FROM community_like_notices n
        WHERE n.item_type = $1 AND n.item_id = $2 AND n.notified_at IS NULL
        ORDER BY n.created_at DESC`,
      [type, id]
    );
    if (pending.length === 0) {
      await client.query('COMMIT');
      return;
    }
    ownerId = pending[0].owner_user_id;
    const fresh = pending.filter(
      (p) => p.still_liked && Date.now() - new Date(p.created_at) < STALE_DAYS * 86400000
    );
    const item = fresh.length > 0 && (await ownerWantsLikePushes(client, ownerId))
      ? await db.getCommunityItem(type, id)
      : null;
    const sendTo = item ? fresh.map((p) => p.user_id) : [];
    await client.query(
      `UPDATE community_like_notices
          SET notified_at = NOW(), pushed = (user_id = ANY($3::int[]))
        WHERE item_type = $1 AND item_id = $2 AND notified_at IS NULL`,
      [type, id, sendTo]
    );
    if (item) push = buildLikePush(await displayName(client, sendTo[0]), sendTo.length - 1, item);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[community-like] flush failed:', err.message);
    return;
  } finally {
    client.release();
  }
  if (push) {
    try {
      await sendPushToUser(ownerId, push.title, push.body, push.data);
    } catch (err) {
      console.error('[community-like] send failed:', err.message);
    }
  }
}

// Items with pending likes whose last push is at least WINDOW_MIN old.
export async function flushPendingLikePushes() {
  const { rows } = await pool.query(
    `SELECT n.item_type, n.item_id
       FROM community_like_notices n
      WHERE n.notified_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM community_like_notices p
           WHERE p.item_type = n.item_type AND p.item_id = n.item_id
             AND p.pushed = TRUE
             AND p.notified_at > NOW() - ($1::int * INTERVAL '1 minute')
        )
      GROUP BY n.item_type, n.item_id
      LIMIT 200`,
    [WINDOW_MIN]
  );
  for (const r of rows) await flushItem(r.item_type, r.item_id);
  return rows.length;
}

export function startCommunityLikeScheduler() {
  const tick = () => flushPendingLikePushes()
    .catch((err) => console.error('[community-like] tick failed:', err.message));
  setInterval(tick, TICK_MS);
}
