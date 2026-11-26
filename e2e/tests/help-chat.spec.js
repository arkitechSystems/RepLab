import { test, expect } from '@playwright/test';
import { createUser, signIn } from './helpers.js';

// Offline FAQ help chat: open from the Workouts header "?" and get an answer.
test('help chat: "?" on Workouts → ask "how do I add a workout" → answer; nonsense → Contact support; Escape closes', async ({ page, request }) => {
  const user = await createUser(request);
  await signIn(page, user);

  await page.getByRole('button', { name: 'Help', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Ask a question').fill('how do I add a workout');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog.getByText('How do I create a workout?').last()).toBeVisible();
  await expect(dialog.getByText('Tap Create a Workout.')).toBeVisible();

  // A nonsense question offers Contact support.
  await dialog.getByLabel('Ask a question').fill('purple banana spaceship');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog.getByRole('link', { name: 'Contact support' }).last()).toBeVisible();

  // Escape closes the sheet.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('help chat opens on the public Support page while signed out', async ({ page }) => {
  await page.goto('/support');
  await page.getByRole('button', { name: 'Ask a question' }).click();
  const dialog = page.getByRole('dialog', { name: 'Help' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'How do I start a program?' }).click();
  await expect(dialog.getByText(/Tap Begin Program/)).toBeVisible();
  // Signed out: no in-app "Show me" links.
  await expect(dialog.getByRole('button', { name: 'Show me' })).toHaveCount(0);
});
