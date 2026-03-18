import { Routes } from '@angular/router';
import { PublicBookingConfirmationComponent } from './public-booking-confirmation.component';
import { PublicSitePageComponent } from './public-site.page';

export const PUBLIC_SITE_ROUTES: Routes = [
  { path: '', component: PublicSitePageComponent },
  { path: 'booking/confirmation/:bookingId', component: PublicBookingConfirmationComponent }
];
