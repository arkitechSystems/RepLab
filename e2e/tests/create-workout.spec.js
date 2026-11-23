import { test, expect } from '@playwright/test';
import { createUser, signIn, today, serverSession } from './helpers.js';

// "Create a Workout" built on the workout session screen (create mode).
const auth = (user) => ({ authorization: `Bearer ${user.token}` });

async function templates(request, user) {
  const res = await request.get('/templates', { headers: auth(user) });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function addCustomExercise(page, name) {
  await page.getByRole('button', { name: /^add exercise$/i }).click();
  await page.getByPlaceholder('Search exercises or type a custom name...').fill(name);
  await page.getByRole('button', { name: `Add "${name}"` }).click();
}

test('create → 135×8 → Create Workout → in My Workouts; scheduled, it starts with Goal 135 × 8; a mid-session exercise stays out of the template', async ({ page, request }) => {
  const user = await createUser(request);
  await signIn(page, user);

  // Workouts → + Create → Create a Workout → name prompt
  await page.locator('[data-tutorial="create-btn"]').first().click();
  await page.locator('[data-tutorial="create-workout-option"]').click();
  await expect(page.getByLabel('Workout Name')).toHaveValue('');
  await expect(page.getByRole('option', { name: 'No programs created yet' })).toHaveCount(1);
  await page.getByLabel('Workout Name').fill('E2E Created Push');
  await page.getByLabel('Description (optional)').fill('made on the session screen');
  await page.getByRole('button', { name: 'Confirm' }).click();

  // Session screen in create mode
  await page.waitForURL('**/session/create?**');
  const createBtn = page.getByRole('button', { name: 'Create Workout' });
  await expect(createBtn).toBeVisible();
  await expect(page.getByRole('button', { name: /begin workout/i })).toHaveCount(0);
  await addCustomExercise(page, 'E2E Bench');
  await page.getByLabel('Set 1 weight').first().fill('135');
  await page.getByLabel('Set 1 reps').first().fill('8');
  await expect(page.locator('button[aria-label="Mark set complete"]')).toHaveCount(0);
  await createBtn.click();

  await page.waitForURL('**/app');
  await expect(page.getByText('"E2E Created Push" created in My Workouts.')).toBeVisible();

  // Saved as a template in My Workouts with the goals; no session, no calendar day.
  const created = (await templates(request, user)).find((t) => t.name === 'E2E Created Push');
  expect(created).toBeTruthy();
  expect(created.description).toBe('made on the session screen');
  expect(created.exercises).toHaveLength(1);
  expect(created.exercises[0].sets[0]).toMatchObject({ plannedReps: 8, suggestedWeight: 135 });
  const programs = await (await request.get('/programs', { headers: auth(user) })).json();
  expect(programs.find((p) => p.id === created.programId)?.name).toBe('My Workouts');
  const sched = await (await request.get(`/schedule?from=2000-01-01&to=2100-01-01`, { headers: auth(user) })).json();
  expect(sched.filter((d) => d.templateId === created.id)).toHaveLength(0);
  expect(await serverSession(request, user, created.id, today())).toBeFalsy();

  // Put it on today's calendar and start it: Goal Wt 135 / Goal Reps 8.
  const put = await request.put('/schedule', { headers: auth(user), data: { schedule: [{ date: today(), templateId: created.id }] } });
  expect(put.ok()).toBeTruthy();
  await page.evaluate(() => {
    localStorage.setItem('wf-default-show-goal-weight', 'true');
    localStorage.setItem('wf-default-show-goal-reps', 'true');
  });
  await page.goto(`/session/${created.id}/${today()}`);
  await expect(page.getByLabel('Set 1 goal weight (long-press to edit)').first()).toHaveText(/135/);
  await expect(page.getByLabel('Set 1 goal reps (long-press to edit)').first()).toHaveText(/8/);
  const session = await serverSession(request, user, created.id, today());
  expect(session.workoutData.exercises[0].sets[0]).toMatchObject({ goalWeight: 135, goalReps: 8 });

  // Add an exercise mid-session and log a set: it saves to this day only.
  await page.getByRole('button', { name: /begin workout/i }).first().click();
  const again = page.getByRole('button', { name: /begin workout/i });
  if (await again.count()) await again.last().click();
  await addCustomExercise(page, 'E2E Curl');
  await page.getByLabel('Set 1 reps').last().fill('12');
  await page.locator('button[aria-label="Mark set complete"]').last().click();
  await expect.poll(async () => (await serverSession(request, user, created.id, today())).workoutData.exercises.map((e) => e.name))
    .toEqual(['E2E Bench', 'E2E Curl']);
  const after = (await templates(request, user)).find((t) => t.id === created.id);
  expect(after.exercises.map((e) => e.name)).toEqual(['E2E Bench']);
});
