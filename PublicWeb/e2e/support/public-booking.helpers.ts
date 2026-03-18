import { expect, type Page } from '@playwright/test';
import { buildPatientData, type PatientData } from './test-data';

export async function openPublicBooking(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('public-booking-form')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reserva tu cita en minutos' })).toBeVisible();
}

export async function createPublicBooking(
  page: Page,
  prefix = 'QA'
): Promise<PatientData> {
  const patient = buildPatientData(prefix);

  await openPublicBooking(page);

  const siteSelect = page.getByTestId('public-site-select');
  const serviceSelect = page.getByTestId('public-service-select');
  const slotOptions = page.getByTestId('public-slot-option');
  const createButton = page.getByTestId('public-create-booking');

  await expect
    .poll(async () => await siteSelect.inputValue(), { message: 'public site should autoselect' })
    .not.toBe('');
  await expect
    .poll(async () => await serviceSelect.inputValue(), { message: 'public service should autoselect' })
    .not.toBe('');
  await expect
    .poll(async () => await slotOptions.count(), { message: 'public availability should load slots' })
    .toBeGreaterThan(0);

  await page.getByTestId('public-patient-name').fill(patient.patientName);
  await page.getByTestId('public-patient-phone').fill(patient.phone);
  await page.getByTestId('public-patient-email').fill(patient.email);
  await page.getByTestId('public-patient-notes').fill(patient.notes);

  const attempts = Math.min(await slotOptions.count(), 6);
  let createEnabled = false;

  for (let index = 0; index < attempts; index += 1) {
    await slotOptions.nth(index).click();

    try {
      await expect(createButton).toBeEnabled({ timeout: 4000 });
      createEnabled = true;
      break;
    } catch {
      // Another concurrent test may have taken the slot; keep trying the next visible option.
    }
  }

  if (!createEnabled) {
    throw new Error('Could not find an enabled slot for public booking automation.');
  }

  await createButton.click();

  return patient;
}

export async function waitForSandboxCheckout(page: Page): Promise<string> {
  await page.waitForURL(/\/public\/payments\/sandbox\/[^/?]+/);
  await expect(page.getByTestId('public-sandbox-checkout')).toBeVisible();

  const bookingId = page.url().match(/\/public\/payments\/sandbox\/([^/?]+)/)?.[1];
  if (!bookingId) {
    throw new Error(`Could not extract bookingId from sandbox URL: ${page.url()}`);
  }

  return bookingId;
}

export async function approveSandboxPayment(page: Page): Promise<void> {
  await expect(page.getByTestId('sandbox-approve-payment')).toBeEnabled();
  await page.getByTestId('sandbox-approve-payment').click();
}

export async function expectConfirmedBooking(page: Page, bookingId: string, patient: PatientData): Promise<void> {
  await page.waitForURL(new RegExp(`/booking/confirmation/${bookingId}$`));
  await expect(page.getByTestId('public-booking-confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation-status-summary')).toContainText('Reserva confirmada');
  await expect(page.getByTestId('confirmation-booking-status')).toContainText('CONFIRMED');
  await expect(page.getByTestId('confirmation-payment-status')).toContainText('PAID');
  await expect(page.getByTestId('confirmation-detail-grid')).toContainText(patient.patientName);
}
