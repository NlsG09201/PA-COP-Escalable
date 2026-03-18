import { Routes } from '@angular/router';
import { PUBLIC_SITE_ROUTES } from './features/public-site/public-site.routes';

export const routes: Routes = [...PUBLIC_SITE_ROUTES, { path: '**', redirectTo: '' }];
