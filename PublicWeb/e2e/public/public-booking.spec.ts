import { test } from '@playwright/test';
import {
  approveSandboxPayment,
  createPublicBooking,
  expectConfirmedBooking,
  waitForSandboxCheckout
} from '../support/public-booking.helpers';

test.describe('public booking flow', () => {
  test('creates a reservation and confirms the sandbox checkout', async ({ page }) => {
    const patient = await createPublicBooking(page);
    const bookingId = await waitForSandboxCheckout(page);

    await test.step('verify sandbox context', async () => {
      await page.getByTestId('sandbox-booking-id').waitFor();
      await page.getByTestId('sandbox-payment-status').waitFor();
    });

    await approveSandboxPayment(page);
    await expectConfirmedBooking(page, bookingId, patient);
  });
});
