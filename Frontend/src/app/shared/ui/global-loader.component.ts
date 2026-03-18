import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isLoading$ | async) {
      <div class="global-loader-backdrop">
        <div class="spinner-border text-primary" role="status" aria-label="Cargando"></div>
      </div>
    }
  `,
  styles: `
    .global-loader-backdrop {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.45);
      backdrop-filter: blur(1px);
      z-index: 2000;
    }
  `
})
export class GlobalLoaderComponent {
  private readonly loadingService = inject(LoadingService);
  protected readonly isLoading$ = this.loadingService.isLoading$.pipe(map((count) => count > 0));
}
