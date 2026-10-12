import { test, expect } from '@playwright/test';
import { createUser, createWorkout, signIn, PASSWORD } from './helpers.js';

test('signing in lands on the Workouts home', async ({ page, request }) => {
  const user = await createUser(request);
  await signIn(page, user);
  await expect(page.getByText('WORKOUTS', { exact: true }).first()).toBeVisible();
});

test('a wrong password shows an error and stays on the login screen', async ({ page, request }) => {
  const user = await createUser(request);
  await page.goto('/login');
  await page.getByPlaceholder('Enter username, email, or phone').fill(user.email);
  await page.getByPlaceholder('Enter password').fill(PASSWORD + 'nope');
  await page.locator('button[type=submit]').click();
  await expect(page.getByText(/didn't match/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("switching accounts never shows the previous user's workouts", async ({ page, request }) => {
  const first = await createUser(request, 'First');
  const second = await createUser(request, 'Second');
  const headers = { authorization: `Bearer ${first.token}` };
  const program = await (await request.post('/programs', { headers, data: { name: 'Only First Has This' } })).json();
  await createWorkout(request, first, 'Day A', [{ name: 'Barbell Bench Press', sets: [{ reps: 8, weight: 135 }] }], program.id);

  await signIn(page, first);
  await page.getByText('MY WORKOUTS').first().click();
  await expect(page.getByText(/only first has this/i).first()).toBeVisible();

  await page.goto('/profile');
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL('**/login');

  await signIn(page, second);
  await expect(page.getByText(/create your first workout/i)).toBeVisible();
  await expect(page.getByText(/only first has this/i)).toHaveCount(0);
  // Nothing from the first account is left in this browser's saved data.
  const leftovers = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => (localStorage.getItem(k) || '').toLowerCase().includes('only first has this')));
  expect(leftovers).toEqual([]);
});
