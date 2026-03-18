import { expect, test } from '@playwright/test';
import { loginAsAdmin } from '../support/auth.helpers';
import {
  approveSandboxPayment,
  createPublicBooking,
  expectConfirmedBooking,
  waitForSandboxCheckout
} from '../support/public-booking.helpers';

test.describe('guided demo flows', () => {
  test('walks through the public booking and dashboard experience', async ({ page }) => {
    const patient = await test.step('create a public reservation', async () => {
      return createPublicBooking(page, 'Demo');
    });

    const bookingId = await test.step('land in sandbox checkout', async () => {
      return waitForSandboxCheckout(page);
    });

    await test.step('approve sandbox payment and verify confirmation', async () => {
      await approveSandboxPayment(page);
      await expectConfirmedBooking(page, bookingId, patient);
    });

    await test.step('enter the professional dashboard', async () => {
      await loginAsAdmin(page);
      await expect(page.getByText('Citas de Hoy')).toBeVisible();
    });

    await test.step('visit core dashboard modules', async () => {
      const navTargets = [
        { navTestId: 'nav-link-appointments', url: /\/app\/appointments$/, headingText: 'Gestion de Citas' },
        { navTestId: 'nav-link-patients', url: /\/app\/patients$/, headingText: 'Gestion de Pacientes' },
        { navTestId: 'nav-link-psych-tests', url: /\/app\/psych-tests$/, headingText: 'Motor de Tests Psicologicos' }
      ] as const;

      for (const target of navTargets) {
        await page.getByTestId(target.navTestId).click();
        await page.waitForURL(target.url);
        await expect(page.getByRole('heading', { name: target.headingText })).toBeVisible();
      }
    });
  });
});
