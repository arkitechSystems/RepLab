// Shared steps for the end-to-end tests. Setup that isn't under test
// (making a user, making a workout) goes straight to the API; the thing
// being tested goes through the real screens.
import { expect } from '@playwright/test';

export const PASSWORD = 'Testpass123!';

let counter = 0;

// A brand-new user, signed up through the API. Returns { email, token }.
export async function createUser(request, firstName = 'Test') {
  counter += 1;
  const email = `e2e-${Date.now()}-${counter}@example.com`;
  const res = await request.post('/auth/signup', {
    data: { identifier: email, password: PASSWORD, firstName, lastName: 'User', zipCode: '75001' },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { token } = await res.json();
  return { email, token };
}

// A workout owned by `user`. `exercises` uses the API's shape:
// [{ name, sets: [{ reps, weight }] }]. Pass programId to put it in a
// program. Returns the template id.
export async function createWorkout(request, user, name, exercises, programId) {
  const res = await request.post('/templates', {
    headers: { authorization: `Bearer ${user.token}` },
    data: { name, exercises, programId },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id;
}

// What the server has stored for this workout on this date.
export async function serverSession(request, user, templateId, date) {
  const res = await request.get(`/sessions/by-template/${templateId}/${date}`, {
    headers: { authorization: `Bearer ${user.token}` },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// Today's date in the browser's format (YYYY-MM-DD, local time).
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Signs in through the real login screen.
export async function signIn(page, user) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter username, email, or phone').fill(user.email);
  await page.getByPlaceholder('Enter password').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/app');
  // Wait for the service worker (keeps the site opening offline) to take
  // over the page. If it takes over mid-reload, Chrome restarts the load and
  // page.reload() reports it as aborted.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
}

// Opens a workout session and taps Begin Workout (plus the second Begin
// Workout when a warm-up prompt appears), ready to log sets.
export async function beginWorkout(page, templateId, date = today()) {
  await page.goto(`/session/${templateId}/${date}`);
  await page.getByRole('button', { name: /begin workout/i }).first().click();
  const again = page.getByRole('button', { name: /begin workout/i });
  if (await again.count()) await again.last().click();
  await expect(page.getByRole('button', { name: /mark complete/i })).toBeVisible();
}

// The set's checkbox. Each set row also carries the same label, so match
// the <button> itself (the row's centre is the weight box).
export function setCheckbox(page, label = 'Mark set complete') {
  return page.locator(`button[aria-label="${label}"]`);
}

// Unchecks a checked set. A checked set's row sits inside the drag-to-reorder
// wrapper, which marks itself aria-disabled; Playwright reads that as the
// checkbox being disabled even though a real tap works, so skip that check.
export async function uncheckSet(page, index = 0) {
  await setCheckbox(page, 'Mark set incomplete').nth(index).click({ force: true });
}

// Types weight + reps into set `n` (1-based, first exercise on screen that
// has a set `n`) and checks it off.
export async function logSet(page, n, weight, reps) {
  await page.getByLabel(`Set ${n} weight`).first().fill(String(weight));
  await page.getByLabel(`Set ${n} reps`).first().fill(String(reps));
  await setCheckbox(page).first().click();
}

// The server's entry for one set of one exercise.
export function entry(session, exerciseName, setNumber) {
  return session?.entries?.find((e) => e.exerciseName === exerciseName && e.setNumber === setNumber);
}
