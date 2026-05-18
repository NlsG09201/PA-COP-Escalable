import { Routes } from '@angular/router';
import { PublicBookingConfirmationComponent } from './public-booking-confirmation.component';
import { PublicSandboxCheckoutComponent } from './public-sandbox-checkout.component';
import { PublicAccountPageComponent } from './public-account.page';
import { PublicAuthPageComponent } from './public-auth.page';
import { PublicSitePageComponent } from './public-site.page';

export const PUBLIC_SITE_ROUTES: Routes = [
  { path: '', component: PublicSitePageComponent },
  { path: 'login', component: PublicAuthPageComponent },
  { path: 'register', component: PublicAuthPageComponent },
  { path: 'account', component: PublicAccountPageComponent },
  { path: 'public/payments/sandbox/:bookingId', component: PublicSandboxCheckoutComponent },
  { path: 'booking/confirmation/:bookingId', component: PublicBookingConfirmationComponent },
];
