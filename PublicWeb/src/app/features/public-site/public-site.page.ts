import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PublicBookingFlowComponent } from './components/public-booking-flow.component';
import { PublicHeroSectionComponent } from './components/public-hero-section.component';
import { PublicPricingGridComponent } from './components/public-pricing-grid.component';
import { PublicServiceCatalogComponent } from './components/public-service-catalog.component';
import { PublicSiteHeaderComponent } from './components/public-site-header.component';
import { PublicAboutSectionComponent } from './components/public-about-section.component';
import { PublicGallerySectionComponent } from './components/public-gallery-section.component';
import { PublicReviewsSectionComponent } from './components/public-reviews-section.component';
import { PublicSiteFooterComponent } from './components/public-site-footer.component';
import { PublicTrustStripComponent } from './components/public-trust-strip.component';
import { PublicSiteFacade } from './data-access/public-site.facade';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    PublicSiteHeaderComponent,
    PublicAboutSectionComponent,
    PublicHeroSectionComponent,
    PublicGallerySectionComponent,
    PublicReviewsSectionComponent,
    PublicTrustStripComponent,
    PublicSiteFooterComponent,
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

      <app-public-trust-strip />

      <app-public-about-section />

      @if (facade.pageError()) {
        <section class="status-strip">
          <div class="container">
            <div class="status-card status-card-danger">
              <strong>No pudimos completar una parte del flujo público.</strong>
              <span>{{ facade.pageError() }}</span>
            </div>
          </div>
        </section>
      }

      <app-public-service-catalog
        [services]="facade.services()"
        [selectedServiceId]="facade.selectedServiceId()"
        (selectService)="facade.onServiceSelected($event)" />

      <app-public-gallery-section />
      <app-public-reviews-section />

      <app-public-pricing-grid
        [services]="facade.services()"
        [selectedServiceId]="facade.selectedServiceId()"
        (selectService)="facade.onServiceSelected($event)" />

      <app-public-booking-flow
        [bookingForm]="facade.bookingForm"
        [departments]="facade.departments()"
        [selectedDepartment]="facade.selectedDepartment()"
        [sites]="facade.filteredSites()"
        [totalSitesCount]="facade.sites().length"
        [siteSearch]="facade.siteSearch()"
        [sitesLoadError]="facade.sitesLoadError()"
        [servicesLoadError]="facade.servicesLoadError()"
        [loadingSites]="facade.loadingSites()"
        [loadingServices]="facade.loadingServices()"
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
        (departmentChange)="facade.onDepartmentSelected($event)"
        (siteSearchChange)="facade.setSiteSearch($event)"
        (retryLoadSites)="facade.retryLoadSites()"
        (retryLoadServices)="facade.retryLoadServices()"
        (siteChange)="facade.onSiteSelected($event)"
        (serviceChange)="facade.onServiceSelected($event)"
        (slotSelected)="facade.bookingForm.controls.slotStartAt.setValue($event)"
        (submitBooking)="facade.bookAppointment()"
        (prepareCheckout)="facade.prepareCheckout()"
        (payNow)="facade.completePayment()" />

      <app-public-site-footer />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .landing-shell {
      color: var(--cop-ink, #0f1c1e);
      background:
        radial-gradient(ellipse 80% 50% at 10% -10%, rgba(13, 110, 106, 0.06), transparent 50%),
        radial-gradient(ellipse 60% 40% at 90% 0%, rgba(30, 107, 154, 0.05), transparent 45%),
        var(--cop-surface, #faf9f7);
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
