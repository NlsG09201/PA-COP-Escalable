import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PublicBookingFlowComponent } from './components/public-booking-flow.component';
import { PublicHeroSectionComponent } from './components/public-hero-section.component';
import { PublicPricingGridComponent } from './components/public-pricing-grid.component';
import { PublicServiceCatalogComponent } from './components/public-service-catalog.component';
import { PublicSiteHeaderComponent } from './components/public-site-header.component';
import { PublicSiteFacade } from './data-access/public-site.facade';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    PublicSiteHeaderComponent,
    PublicHeroSectionComponent,
    PublicServiceCatalogComponent,
    PublicPricingGridComponent,
    PublicBookingFlowComponent
  ],
  providers: [PublicSiteFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="landing-shell">
      <app-public-site-header />

      <app-public-hero-section
        [selectedServiceTitle]="facade.selectedService()?.title ?? ''"
        [selectedPrice]="facade.selectedService()?.priceToPay ?? 0"
        [selectedDurationMinutes]="facade.selectedService()?.durationMinutes ?? 0"
        [serviceCount]="facade.services().length" />

      @if (facade.pageError()) {
        <section class="status-strip">
          <div class="container">
            <div class="status-card status-card-danger">
              <strong>No pudimos completar una parte del flujo publico.</strong>
              <span>{{ facade.pageError() }}</span>
            </div>
          </div>
        </section>
      }

      @if (facade.loadingSites() && !facade.hasCatalogData()) {
        <section class="status-strip">
          <div class="container">
            <div class="status-card">
              <strong>Cargando configuracion publica...</strong>
              <span>Estamos consultando sedes, catalogo y disponibilidad inicial.</span>
            </div>
          </div>
        </section>
      }

      @if (facade.loadingServices() && facade.sites().length > 0) {
        <section class="status-strip">
          <div class="container">
            <div class="status-card">
              <strong>Actualizando catalogo para la sede seleccionada...</strong>
              <span>Los servicios y horarios se sincronizan en tiempo real con la API publica.</span>
            </div>
          </div>
        </section>
      }

      <app-public-service-catalog
        [services]="facade.services()"
        [selectedServiceId]="facade.selectedServiceId()"
        (selectService)="facade.onServiceSelected($event)" />

      <app-public-pricing-grid
        [services]="facade.services()"
        [selectedServiceId]="facade.selectedServiceId()"
        (selectService)="facade.onServiceSelected($event)" />

      <app-public-booking-flow
        [bookingForm]="facade.bookingForm"
        [sites]="facade.sites()"
        [services]="facade.services()"
        [slots]="facade.availabilitySlots()"
        [bookings]="facade.recentBookings()"
        [bookingQuote]="facade.bookingQuote()"
        [selectedService]="facade.selectedService()"
        [selectedSlotStartAt]="facade.bookingForm.controls.slotStartAt.value"
        [reservationSuccess]="facade.reservationSuccess()"
        [loadingAvailability]="facade.loadingAvailability()"
        [loadingQuote]="facade.loadingQuote()"
        [preparingCheckout]="facade.preparingCheckout()"
        [submitting]="facade.submitting()"
        [processingPayment]="facade.processingPayment()"
        (siteChange)="facade.onSiteSelected($event)"
        (serviceChange)="facade.onServiceSelected($event)"
        (slotSelected)="facade.bookingForm.controls.slotStartAt.setValue($event)"
        (submitBooking)="facade.bookAppointment()"
        (prepareCheckout)="facade.prepareCheckout()"
        (payNow)="facade.completePayment()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .landing-shell {
      color: #0f172a;
      background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(124, 58, 237, 0.12), transparent 26%),
        #f8fafc;
    }
    .status-strip {
      padding: 0 0 1.5rem;
    }

    .status-card {
      border-radius: 1.2rem;
      padding: 1rem 1.25rem;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
      display: grid;
      gap: 0.35rem;
    }

    .status-card span {
      color: #475569;
    }

    .status-card-danger {
      background: #fff7ed;
      border-color: #fdba74;
    }
  `
})
export class PublicSitePageComponent {
  protected readonly facade = inject(PublicSiteFacade);
}
