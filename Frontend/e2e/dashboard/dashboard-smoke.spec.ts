import { expect, test } from '@playwright/test';
import { loginAsAdmin } from '../support/auth.helpers';

test.describe('dashboard smoke flow', () => {
  test('logs in and navigates key admin modules', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByText('Citas de Hoy')).toBeVisible();

    const routes = [
      {
        navTestId: 'nav-link-appointments',
        url: /\/app\/appointments$/,
        headingText: 'Gestion de Citas'
      },
      {
        navTestId: 'nav-link-patients',
        url: /\/app\/patients$/,
        headingText: 'Gestion de Pacientes'
      },
      {
        navTestId: 'nav-link-psychology',
        url: /\/app\/psychology$/,
        headingText: 'Modulo Psicologico'
      }
    ] as const;

    for (const route of routes) {
      await page.getByTestId(route.navTestId).click();
      await page.waitForURL(route.url);
      await expect(page.getByRole('heading', { name: route.headingText })).toBeVisible();
    }
  });
});
