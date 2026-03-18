import { Routes } from '@angular/router';
import { PublicBookingConfirmationComponent } from './public-booking-confirmation.component';
import { PublicSandboxCheckoutComponent } from './public-sandbox-checkout.component';
import { PublicSitePageComponent } from './public-site.page';

export const PUBLIC_SITE_ROUTES: Routes = [
  { path: '', component: PublicSitePageComponent },
  { path: 'public/payments/sandbox/:bookingId', component: PublicSandboxCheckoutComponent },
  { path: 'booking/confirmation/:bookingId', component: PublicBookingConfirmationComponent }
];
