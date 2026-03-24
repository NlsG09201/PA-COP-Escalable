import { Routes } from '@angular/router';
import { ServiceListComponent } from './pages/service-list/service-list.component';

export const SERVICES_ROUTES: Routes = [
  {
    path: '',
    component: ServiceListComponent
  }
];
