import { test, expect } from '@playwright/test';
import { createUser, createWorkout, signIn } from './helpers.js';

// The My Workouts page (Workouts → My Workouts): grouped by month created,
// Move into a program (lands after the program's last workout), Edit returns
// to My Workouts.
const auth = (user) => ({ authorization: `Bearer ${user.token}` });
const squat = [{ name: 'E2E Squat', sets: [{ reps: 5, weight: 135 }] }];

async function myWorkout(request, user, name) {
  const res = await request.post('/templates', { headers: auth(user), data: { name, exercises: squat, saveToMyWorkouts: true } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id;
}

async function openMyWorkouts(page) {
  await page.locator('[data-tutorial="my-workouts"]').first().click();
  await expect(page.getByText('// Uncategorized')).toBeVisible();
}

const card = (page, name) => page.getByTestId('my-workout-card').filter({ hasText: name });

test('Move puts a My Workouts workout on the day after the program\'s last workout and says where', async ({ page, request }) => {
  const user = await createUser(request);
  const prog = await (await request.post('/programs', { headers: auth(user), data: { name: 'E2E PPL' } })).json();
  const push = await createWorkout(request, user, 'E2E Push', squat, prog.id);
  const pull = await createWorkout(request, user, 'E2E Pull', squat, prog.id);
  const layout = await request.put(`/programs/${prog.id}/layout`, {
    headers: auth(user),
    data: { slots: [{ templateId: push }, { templateId: pull }, ...Array(5).fill({ rest: true })] },
  });
  expect(layout.ok(), await layout.text()).toBeTruthy();
  const arms = await myWorkout(request, user, 'E2E Arms');

  await signIn(page, user);
  await openMyWorkouts(page);
  // Made today, so it's under this month's header.
  const month = new Date().toLocaleString('en-US', { month: 'long' }).toUpperCase();
  await expect(page.getByTestId('workout-month-group').first().locator('h4')).toHaveText(`${month} ${new Date().getFullYear()}`);

  await card(page, 'E2E Arms').getByRole('button', { name: 'Move' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /E2E PPL/ }).click();
  await expect(page.getByText('Moved to E2E PPL — Week 1, Day 3.')).toBeVisible();
  await expect(card(page, 'E2E Arms')).toHaveCount(0);

  const templates = await (await request.get('/templates', { headers: auth(user) })).json();
  const days = templates.filter((t) => t.programId === prog.id).sort((a, b) => a.sortOrder - b.sortOrder);
  expect(days.map((t) => (t.isRest ? 'Rest' : t.name))).toEqual(['E2E Push', 'E2E Pull', 'E2E Arms', 'Rest', 'Rest', 'Rest', 'Rest']);
  expect(days[2].id).toBe(arms);
});

test('Edit on a My Workouts card opens Edit Workout, and Save comes back to My Workouts', async ({ page, request }) => {
  const user = await createUser(request);
  const id = await myWorkout(request, user, 'E2E Legs');

  await signIn(page, user);
  await openMyWorkouts(page);
  await card(page, 'E2E Legs').getByRole('button', { name: 'Edit E2E Legs' }).click();
  await page.waitForURL(`**/clientworkouts/edit/${id}?from=my`);
  await page.getByLabel('Workout Name').fill('E2E Legs Renamed');
  await page.getByRole('button', { name: /save changes/i }).click();

  await page.waitForURL('**/app');
  await expect(page.getByText('// Uncategorized')).toBeVisible();
  await expect(card(page, 'E2E Legs Renamed')).toBeVisible();
});
