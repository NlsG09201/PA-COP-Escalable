import { CommonModule } from '@angular/common';
import { Component, inject, isDevMode } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthApiService, SiteVm } from '../../core/services/auth-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="container py-5" data-testid="login-page">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <div class="text-center mb-3">
                <img src="/brand/logo.png" alt="COP" width="56" height="56" class="rounded-3 shadow-sm" />
              </div>
              <h4 class="mb-3 text-center">Ingreso Clinico</h4>
              <p class="text-muted mb-4 text-center">Acceso para administradores, odontologos y psicologos.</p>

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
                  <label class="form-label">Sede</label>
                  <select
                    class="form-select"
                    size="8"
                    style="min-height: 10rem;"
                    [class.is-invalid]="isInvalid('siteId')"
                    formControlName="siteId"
                    data-testid="login-site-select">
                    <option value="">Seleccione una sede</option>
                    @for (site of filteredSites; track site.id) {
                      <option [value]="site.id">
                        {{ site.name }}@if (site.municipality) { · {{ site.municipality }} }@if (site.department) { ({{ site.department }}) }
                      </option>
                    }
                  </select>
                  <div class="form-text">{{ filteredSites.length }} sedes visibles · {{ allSites.length }} en total</div>
                  @if (sitesLoadError) {
                    <div class="text-danger small">{{ sitesLoadError }}</div>
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
                    Desarrollo: usuario <strong>nelsonh09</strong> (también puedes usar tu correo vinculado).
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
  `,
})
export class LoginComponent {
  private static readonly DEV_DEFAULT_USERNAME = 'nelsonh09';
  private static readonly DEV_DEFAULT_PASSWORD = 'NelsonH09092001';

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

  protected readonly form = this.fb.nonNullable.group({
    username: [isDevMode() ? LoginComponent.DEV_DEFAULT_USERNAME : '', [Validators.required]],
    password: [isDevMode() ? LoginComponent.DEV_DEFAULT_PASSWORD : '', [Validators.required]],
    siteId: ['', [Validators.required]],
  });

  constructor() {
    forkJoin({
      sites: this.authApi.getSites$().pipe(catchError(() => of([] as SiteVm[]))),
      departments: this.authApi.getDepartments$().pipe(catchError(() => of([] as string[]))),
    }).subscribe(({ sites, departments }) => {
      this.allSites = sites;
      this.departments = departments;
      this.applySiteFilter();
      if (sites.length === 0) {
        this.sitesLoadError =
          'No se cargaron sedes. Verifica que el API esté arriba (gateway :8080) y vuelve a intentar.';
      }
    });
  }

  protected applySiteFilter(): void {
    const dep = this.departmentFilter.trim();
    this.filteredSites = dep
      ? this.allSites.filter((s) => String(s.department ?? '').toLowerCase() === dep.toLowerCase())
      : [...this.allSites];
    const current = this.form.controls.siteId.value;
    if (!this.filteredSites.some((s) => s.id === current)) {
      this.form.controls.siteId.setValue(this.filteredSites[0]?.id ?? '');
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
