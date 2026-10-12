// Offline saving: the reason the TanStack Query migration happened.
// context.setOffline(true) cuts the browser's network like airplane mode.
import { test, expect } from '@playwright/test';
import {
  createUser, createWorkout, signIn, beginWorkout, logSet, setCheckbox,
  serverSession, entry, today, uncheckSet,
} from './helpers.js';

const BENCH = 'Barbell Bench Press';

async function setUp(page, request) {
  const user = await createUser(request);
  const templateId = await createWorkout(request, user, 'E2E Offline', [
    { name: BENCH, sets: [{ reps: 8, weight: 135 }, { reps: 8, weight: 135 }] },
  ]);
  await signIn(page, user);
  await beginWorkout(page, templateId);
  return { user, templateId };
}

test('sets logged offline survive a reload and save once when back online', async ({ page, context, request }) => {
  const { user, templateId } = await setUp(page, request);

  await context.setOffline(true);
  await logSet(page, 1, 155, 5);
  await expect(page.getByText(/1 change waiting to sync/)).toBeVisible();

  // Nothing reached the server yet.
  expect(entry(await serverSession(request, user, templateId, today()), BENCH, 1)?.isCompleted).toBeFalsy();

  // Close and reopen while still offline: the set is still logged.
  await page.reload();
  await expect(page.getByLabel('Set 1 weight').first()).toHaveValue('155');
  await expect(page.getByLabel('Set 1 reps').first()).toHaveValue('5');
  await expect(setCheckbox(page, 'Mark set incomplete')).toHaveCount(1);

  await context.setOffline(false);

  await expect.poll(async () => entry(await serverSession(request, user, templateId, today()), BENCH, 1))
    .toMatchObject({ weight: 155, reps: 5, isCompleted: true });
  await expect(page.getByText(/waiting to sync/)).toHaveCount(0);
  // Saved once: one session for this day, with exactly the two planned sets.
  const session = await serverSession(request, user, templateId, today());
  expect(session.entries.filter((e) => e.exerciseName === BENCH)).toHaveLength(2);
});

test('several offline changes are sent in order', async ({ page, context, request }) => {
  const { user, templateId } = await setUp(page, request);

  await context.setOffline(true);
  await logSet(page, 1, 160, 5);
  await logSet(page, 2, 165, 4);
  await uncheckSet(page); // uncheck set 1 again
  await context.setOffline(false);

  // The last change wins: set 1 unchecked, set 2 checked.
  await expect.poll(async () => {
    const s = await serverSession(request, user, templateId, today());
    return [entry(s, BENCH, 1)?.isCompleted, entry(s, BENCH, 2)?.isCompleted];
  }).toEqual([false, true]);
  const s = await serverSession(request, user, templateId, today());
  expect(entry(s, BENCH, 2)).toMatchObject({ weight: 165, reps: 4 });
});

test('Mark Complete offline finishes the workout once back online', async ({ page, context, request }) => {
  const { user, templateId } = await setUp(page, request);

  await context.setOffline(true);
  await logSet(page, 1, 135, 8);
  await page.getByRole('button', { name: /mark complete/i }).click();
  expect((await serverSession(request, user, templateId, today())).completed).toBe(false);

  await context.setOffline(false);

  await expect.poll(async () => (await serverSession(request, user, templateId, today())).completed)
    .toBe(true);
  expect(entry(await serverSession(request, user, templateId, today()), BENCH, 1))
    .toMatchObject({ weight: 135, reps: 8, isCompleted: true });
});
