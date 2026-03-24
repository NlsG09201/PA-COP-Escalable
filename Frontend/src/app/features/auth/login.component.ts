import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthApiService } from '../../core/services/auth-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container py-5" data-testid="login-page">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <h4 class="mb-3">Ingreso Clinico</h4>
              <p class="text-muted mb-4">Acceso para administradores, odontologos y psicologos.</p>

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
                <div class="mb-3">
                  <label class="form-label">Sede</label>
                  <select class="form-select" [class.is-invalid]="isInvalid('siteId')" formControlName="siteId" data-testid="login-site-select">
                    <option value="">Seleccione una sede</option>
                    @for (site of sites; track site.id) {
                      <option [value]="site.id">{{ site.name }}</option>
                    }
                  </select>
                  @if (isInvalid('siteId')) {
                    <div class="invalid-feedback">Selecciona una sede para continuar.</div>
                  }
                </div>
                @if (errorMessage) {
                  <div class="alert alert-danger py-2" data-testid="login-error-message">{{ errorMessage }}</div>
                }
                <div class="alert alert-secondary py-2 small">
                  Credenciales local dev: <strong>admin@cop.local</strong> / <strong>Admin123ChangeMe</strong>
                </div>
                <button class="btn btn-primary w-100" data-testid="login-submit" [disabled]="form.invalid || loading">
                  {{ loading ? 'Ingresando...' : 'Ingresar' }}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private static readonly DEV_DEFAULT_USERNAME = 'admin@cop.local';
  private static readonly DEV_DEFAULT_PASSWORD = 'Admin123ChangeMe';

  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  protected loading = false;
  protected errorMessage = '';
  protected sites: Array<{ id: string; name: string }> = [];

  protected readonly form = this.fb.nonNullable.group({
    username: [LoginComponent.DEV_DEFAULT_USERNAME, [Validators.required]],
    password: [LoginComponent.DEV_DEFAULT_PASSWORD, [Validators.required]],
    siteId: ['', [Validators.required]]
  });

  constructor() {
    this.authApi
      .getSites$()
      .pipe(catchError(() => of([])))
      .subscribe((sites) => {
        this.sites = sites;
        if (sites.length > 0 && !this.form.controls.siteId.value) {
          this.form.controls.siteId.setValue(sites[0].id);
        }
      });
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
      }
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
        : '') ||
      (typeof error.error === 'string' ? error.error : '');

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 401) {
      return 'Credenciales invalidas. Usa admin@cop.local / Admin123ChangeMe y verifica la sede seleccionada.';
    }
    if (error.status === 400) {
      return 'Solicitud invalida. Revisa los datos del formulario.';
    }
    if (error.status === 0) {
      return 'El gateway no esta disponible aun. Espera unos segundos e intenta nuevamente.';
    }
    return 'No fue posible iniciar sesion en este momento.';
  }
}
