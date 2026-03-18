import { expect, type Page } from '@playwright/test';
import { automationConfig } from './test-data';

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByTestId('login-form')).toBeVisible();

  const siteSelect = page.getByTestId('login-site-select');
  await expect
    .poll(async () => await siteSelect.locator('option').count(), { message: 'login should load at least one site option' })
    .toBeGreaterThan(1);

  if ((await siteSelect.inputValue()) === '') {
    await siteSelect.selectOption({ index: 1 });
  }

  await page.getByTestId('login-username').fill(automationConfig.adminUsername);
  await page.getByTestId('login-password').fill(automationConfig.adminPassword);
  await page.getByTestId('login-submit').click();

  await page.waitForURL(/\/app\/dashboard$/);
  await expect(page.getByTestId('app-shell')).toBeVisible();
}
