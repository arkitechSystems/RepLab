import { test, expect } from '@playwright/test';
import {
  createUser, createWorkout, signIn, beginWorkout, logSet, setCheckbox,
  serverSession, entry, today, uncheckSet,
} from './helpers.js';

const BENCH = 'Barbell Bench Press';

async function setUp(page, request) {
  const user = await createUser(request);
  const templateId = await createWorkout(request, user, 'E2E Push', [
    { name: BENCH, sets: [{ reps: 8, weight: 135 }, { reps: 8, weight: 135 }] },
  ]);
  await signIn(page, user);
  await beginWorkout(page, templateId);
  return { user, templateId };
}

test('checking a set saves it to the server right away', async ({ page, request }) => {
  const { user, templateId } = await setUp(page, request);

  await logSet(page, 1, 140, 9);

  await expect.poll(async () => entry(await serverSession(request, user, templateId, today()), BENCH, 1))
    .toMatchObject({ weight: 140, reps: 9, isCompleted: true });
});

test('a logged set is still there after reloading the page', async ({ page, request }) => {
  const { user, templateId } = await setUp(page, request);
  await logSet(page, 1, 145, 7);
  await expect.poll(async () => entry(await serverSession(request, user, templateId, today()), BENCH, 1)?.isCompleted)
    .toBe(true);

  await page.reload();
  await expect(page.getByLabel('Set 1 weight').first()).toHaveValue('145');
  await expect(page.getByLabel('Set 1 reps').first()).toHaveValue('7');
  await expect(setCheckbox(page, 'Mark set incomplete')).toHaveCount(1);
});

test('unchecking a set saves that too', async ({ page, request }) => {
  const { user, templateId } = await setUp(page, request);
  await logSet(page, 1, 150, 6);
  await expect.poll(async () => entry(await serverSession(request, user, templateId, today()), BENCH, 1)?.isCompleted)
    .toBe(true);

  await uncheckSet(page);

  await expect.poll(async () => entry(await serverSession(request, user, templateId, today()), BENCH, 1)?.isCompleted)
    .toBe(false);
});

test('Mark Complete finishes the workout on the server', async ({ page, request }) => {
  const { user, templateId } = await setUp(page, request);
  await logSet(page, 1, 135, 8);
  await logSet(page, 2, 135, 8);

  await page.getByRole('button', { name: /mark complete/i }).click();

  await expect.poll(async () => (await serverSession(request, user, templateId, today())).completed)
    .toBe(true);
  const session = await serverSession(request, user, templateId, today());
  expect(entry(session, BENCH, 1)).toMatchObject({ weight: 135, reps: 8, isCompleted: true });
  expect(entry(session, BENCH, 2)).toMatchObject({ weight: 135, reps: 8, isCompleted: true });
});
