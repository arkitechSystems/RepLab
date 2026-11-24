import { test, expect } from '@playwright/test';
import { createUser, createWorkout, signIn } from './helpers.js';

// Program builder: Create Program opens the new program's sample calendar
// (Week N, Day 1–7). Days are filled with copies of workouts, weeks are
// added / duplicated, Create a Workout from a day lands on that day, and an
// edit can be applied to every copy in the program.
const auth = (user) => ({ authorization: `Bearer ${user.token}` });
const shots = process.env.E2E_SCREENSHOT_DIR;

async function programDays(request, user, name) {
  const programs = await (await request.get('/programs', { headers: auth(user) })).json();
  const program = programs.find((p) => p.name === name);
  const templates = await (await request.get('/templates', { headers: auth(user) })).json();
  return {
    program,
    days: templates.filter((t) => t.programId === program.id).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

test('build a program on its sample calendar: copy, duplicate week, create on a day, edit all copies', async ({ page, request }) => {
  const user = await createUser(request);
  await createWorkout(request, user, 'E2E Arms', [{ name: 'Barbell Curl', sets: [{ reps: 10, weight: 60 }] }]);
  await signIn(page, user);

  // Create Program → straight onto an empty Week 1.
  await page.goto('/programs/create');
  await page.getByLabel('Program Name').fill('E2E Builder');
  await page.getByRole('button', { name: 'Create Program' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByText('Sample Calendar')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('WEEK 1');
  await expect(page.getByText('Tap to add a workout')).toHaveCount(7);
  if (shots) await page.screenshot({ path: `${shots}/builder-1-empty-week.png`, fullPage: true });

  // Day 1 ← a copy of a My Workouts workout.
  await page.getByText('Tap to add a workout').first().click();
  await page.getByText('Copy from My Workouts').click();
  if (shots) await page.screenshot({ path: `${shots}/builder-2-sheet.png` });
  await page.getByRole('dialog').getByText('E2E Arms').click();
  // Saving fills the other empty days with rest days (programs are whole weeks).
  await expect(page.getByLabel('Week 1 · Day 1: E2E Arms')).toBeVisible();
  await expect(page.getByText('Tap to add a workout')).toHaveCount(0);

  // Day 1 is Monday.
  await page.getByLabel('Day 1 is').selectOption('1');
  await expect(page.getByText('Day 1 is now Monday.')).toBeVisible();

  // Duplicate Week 1 → Week 2.
  await page.getByRole('button', { name: 'Duplicate Week 1' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('WEEK 2');
  let { program, days } = await programDays(request, user, 'E2E Builder');
  expect(program.programDetails).toEqual({ startWeekday: 1 });
  expect(days.map((d) => (d.isRest ? 'rest' : d.name))).toEqual([
    'E2E Arms', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest',
    'E2E Arms', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest',
  ]);
  expect(days[0].id).not.toBe(days[7].id);
  if (shots) await page.screenshot({ path: `${shots}/builder-3-week2.png`, fullPage: true });

  // Create a Workout from Week 2 Day 3 → lands on that day.
  await page.getByLabel('Week 2 · Day 3 · Wed: Rest day').click();
  await page.getByText('Create a new workout').click();
  await expect(page.getByText('E2E Builder', { exact: true }).last()).toBeVisible();
  await page.getByLabel('Workout Name').fill('E2E Legs');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.waitForURL('**/session/create?**slot=9**');
  await page.getByRole('button', { name: /^add exercise$/i }).click();
  await page.getByPlaceholder('Search exercises or type a custom name...').fill('E2E Squat');
  await page.getByRole('button', { name: 'Add "E2E Squat"' }).click();
  await page.getByLabel('Set 1 weight').first().fill('225');
  await page.getByLabel('Set 1 reps').first().fill('5');
  await page.getByRole('button', { name: 'Create Workout' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByText('Sample Calendar')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('WEEK 2');
  ({ days } = await programDays(request, user, 'E2E Builder'));
  expect(days).toHaveLength(14);
  expect(days[9].name).toBe('E2E Legs');

  // Month view.
  await page.getByRole('button', { name: 'Monthly' }).click();
  await expect(page.getByLabel('Week 2 · Day 3 · Wed: E2E Legs')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/builder-4-month.png`, fullPage: true });

  // Edit Week 1 Day 1 and apply it to the copy in Week 2.
  await page.getByLabel('Week 1 · Day 1 · Mon: E2E Arms').click();
  await page.getByRole('dialog').getByText('Edit', { exact: true }).click();
  await page.waitForURL('**/clientworkouts/edit/**');
  await page.getByLabel('Workout Name').fill('E2E Arms Day');
  await page.getByLabel(/Apply this change to all copies in this program/).check();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.waitForURL('**/app');
  await expect(page.getByText('Sample Calendar')).toBeVisible();
  ({ days } = await programDays(request, user, 'E2E Builder'));
  expect(days[0].name).toBe('E2E Arms Day');
  expect(days[7].name).toBe('E2E Arms Day');

  // Begin the built program: Day 1 is Monday, so the date picker starts on
  // the next Monday (today if it is one). Same begin flow as library programs.
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((1 - now.getDay() + 7) % 7));
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.getByRole('button', { name: 'Begin Program' }).click();
  await expect(page.locator('input[type=date]')).toHaveValue(ymd(monday));
  await page.getByRole('button', { name: 'Schedule' }).click();
  await page.waitForURL('**/calendar**');
  const sched = await (await request.get(`/schedule?from=${ymd(monday)}&to=${ymd(new Date(monday.getTime() + 13 * 864e5))}`, { headers: auth(user) })).json();
  expect(sched).toHaveLength(14);
  expect(sched.find((d) => d.date === ymd(monday)).templateName).toBe('E2E Arms Day');
  // The Calendar shows it on that Monday.
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1);
  await page.goto(`/calendar?view=week&week=${ymd(sunday)}`);
  await expect(page.getByText('E2E Arms Day')).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/builder-5-calendar.png`, fullPage: true });
});
