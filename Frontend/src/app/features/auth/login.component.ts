import { CommonModule } from '@angular/common';
import { Component, inject, isDevMode } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { AuthApiService, SiteVm } from '../../core/services/auth-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="cop-login-page" data-testid="login-page">
      <div class="container py-4">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <div class="text-center mb-3">
                <img src="/brand/logo.png" alt="COP" width="56" height="56" class="rounded-3 shadow-sm" />
              </div>
              <h4 class="mb-3 text-center">Ingreso clínico</h4>
              <p class="text-muted mb-4 text-center">Acceso para administradores, odontólogos y psicólogos.</p>

              <form [formGroup]="form" (ngSubmit)="submit()" data-testid="login-form">
                <div class="mb-3">
                  <label class="form-label">Usuario</label>
                  <input class="form-control" [class.is-invalid]="isInvalid('username')" formControlName="username" data-testid="login-username" />
                  @if (isInvalid('username')) {
                    <div class="invalid-feedback">El usuario es obligatorio.</div>
                  }
                </div>
                <div class="mb-3">
                  <label class="form-label">Contrasena</label>
                  <input
                    type="password"
                    class="form-control"
                    [class.is-invalid]="isInvalid('password')"
                    formControlName="password"
                    data-testid="login-password" />
                  @if (isInvalid('password')) {
                    <div class="invalid-feedback">La contrasena es obligatoria.</div>
                  }
                </div>
                <div class="mb-2">
                  <label class="form-label">Departamento (filtro)</label>
                  <select class="form-select" [(ngModel)]="departmentFilter" [ngModelOptions]="{ standalone: true }" (change)="applySiteFilter()">
                    <option value="">Todos — {{ allSites.length }} sedes</option>
                    @for (dep of departments; track dep) {
                      <option [value]="dep">{{ dep }}</option>
                    }
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label" for="site-search">Buscar sede</label>
                  <input
                    id="site-search"
                    class="form-control mb-2"
                    placeholder="Nombre, municipio o departamento…"
                    [(ngModel)]="siteSearch"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="applySiteFilter()"
                    [disabled]="sitesLoading" />
                  <label class="form-label" for="login-site-select">Sede</label>
                  @if (sitesLoading) {
                    <p class="form-text d-flex align-items-center gap-2 mb-1">
                      <span class="spinner-border spinner-border-sm"></span> Cargando sedes…
                    </p>
                  }
                  <select
                    class="form-select"
                    [class.is-invalid]="isInvalid('siteId')"
                    formControlName="siteId"
                    data-testid="login-site-select"
                    [disabled]="sitesLoading">
                    <option value="">Seleccione una sede</option>
                    @for (site of filteredSites; track site.id) {
                      <option [value]="site.id">
                        {{ site.name }}@if (site.municipality) { · {{ site.municipality }} }@if (site.department) { ({{ site.department }}) }
                      </option>
                    }
                  </select>
                  <div class="form-text">{{ filteredSites.length }} sedes visibles · {{ allSites.length }} en total</div>
                  @if (sitesLoadError) {
                    <div class="text-danger small" role="alert">{{ sitesLoadError }} <button type="button" class="btn btn-link btn-sm p-0" (click)="loadSites()">Reintentar</button></div>
                  }
                  @if (isInvalid('siteId')) {
                    <div class="invalid-feedback d-block">Selecciona una sede para continuar.</div>
                  }
                </div>
                @if (errorMessage) {
                  <div class="alert alert-danger py-2" data-testid="login-error-message">{{ errorMessage }}</div>
                }
                @if (showDevLoginHint) {
                  <div class="alert alert-secondary py-2 small">
                    Modo desarrollo: usa las credenciales de tu entorno local (.env / Docker).
                  </div>
                }
                <button class="btn btn-primary w-100" data-testid="login-submit" [disabled]="form.invalid || loading">
                  {{ loading ? 'Ingresando...' : 'Ingresar' }}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  protected readonly showDevLoginHint = isDevMode();

  protected loading = false;
  protected errorMessage = '';
  protected sitesLoadError = '';
  protected allSites: SiteVm[] = [];
  protected filteredSites: SiteVm[] = [];
  protected departments: string[] = [];
  protected departmentFilter = '';
  protected siteSearch = '';
  protected sitesLoading = true;

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    siteId: ['', [Validators.required]],
  });

  constructor() {
    this.loadSites();
  }

  protected loadSites(): void {
    this.sitesLoading = true;
    this.sitesLoadError = '';
    forkJoin({
      sites: this.authApi.getSites$(),
      departments: this.authApi.getDepartments$().pipe(catchError(() => of([] as string[]))),
    }).subscribe({
      next: ({ sites, departments }) => {
        this.sitesLoading = false;
        this.allSites = sites;
        this.departments = departments;
        this.applySiteFilter();
        if (sites.length === 0) {
          this.sitesLoadError = this.emptySitesHint();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.sitesLoading = false;
        this.allSites = [];
        this.departments = [];
        this.applySiteFilter();
        this.sitesLoadError = this.formatSitesHttpError(err);
      },
    });
  }

  private emptySitesHint(): string {
    if (API_BASE_URL.startsWith('/')) {
      return 'No hay sedes en la respuesta. Redeploy en Vercel con proxy /render-api y comprueba https://pa-cop-escalable.onrender.com/public/sites';
    }
    if (/localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
      return 'No se cargaron sedes. Ejecuta ng serve (proxy /render-api) o levanta el gateway local en :8080.';
    }
    return `No se cargaron sedes. Verifica el API (${API_BASE_URL}) y reintenta.`;
  }

  private formatSitesHttpError(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return API_BASE_URL.startsWith('/')
        ? 'Sin conexión al API. Haz Redeploy en Vercel (RENDER_API_HOST=pa-cop-escalable.onrender.com) o usa ng serve con proxy.conf.json.'
        : 'Sin conexión al API. Comprueba que Render esté Live: https://pa-cop-escalable.onrender.com/health/live';
    }
    if (err.status === 404) {
      return 'Ruta del API no encontrada (404). URL del servicio: https://pa-cop-escalable.onrender.com';
    }
    const detail = typeof err.error === 'string' && err.error.includes('<!doctype')
      ? ' (el servidor devolvió HTML en lugar de JSON; falta proxy /render-api en Vercel)'
      : '';
    return `Error al cargar sedes (${err.status || 'red'}).${detail} Reintenta.`;
  }

  protected applySiteFilter(): void {
    const dep = this.departmentFilter.trim().toLowerCase();
    const q = this.siteSearch.trim().toLowerCase();
    this.filteredSites = this.allSites.filter((s) => {
      if (dep && String(s.department ?? '').toLowerCase() !== dep) return false;
      if (!q) return true;
      const haystack = [s.name, s.municipality, s.department]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    const current = this.form.controls.siteId.value;
    if (current && !this.filteredSites.some((s) => s.id === current)) {
      this.form.controls.siteId.setValue('');
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';

    const { username, password, siteId } = this.form.getRawValue();
    this.authApi.login$(username, password, siteId).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/app/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.resolveErrorMessage(error);
      },
    });
  }

  protected isInvalid(controlName: 'username' | 'password' | 'siteId'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    const apiMessage =
      (typeof error.error === 'object' && error.error && 'message' in error.error
        ? String(error.error.message)
        : '') || (typeof error.error === 'string' ? error.error : '');

    if (apiMessage) return apiMessage;
    if (error.status === 401) return 'Credenciales invalidas. Verifica usuario, contrasena y sede seleccionada.';
    if (error.status === 400) return 'Solicitud invalida. Revisa los datos del formulario.';
    if (error.status === 502 || error.status === 503) {
      return 'El servidor aún no responde (502). Espera unos segundos y recarga la página.';
    }
    if (error.status === 0) return 'Sin conexión al API. ¿Está corriendo docker compose?';
    return 'No fue posible iniciar sesion en este momento.';
  }
}
