import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DASHBOARD_URL } from '../../core/config/dashboard.config';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';
import { PublicBookingService, PublicSiteVm } from './data-access/public-booking.service';
import { PublicSiteHeaderComponent } from './components/public-site-header.component';
import { PublicSiteFooterComponent } from './components/public-site-footer.component';

@Component({
  selector: 'app-public-auth-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PublicSiteHeaderComponent, PublicSiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <app-public-site-header />

      <section class="auth-section">
        <div class="container">
          <div class="row g-4 g-xl-5 align-items-stretch justify-content-center">
            <div class="col-lg-5 d-none d-lg-flex">
              <aside class="auth-aside cop-card h-100">
                <span class="cop-section-eyebrow">Pacientes COP</span>
                <h1 class="auth-aside-title">Tu salud, en un solo lugar</h1>
                <p class="auth-aside-copy">
                  Crea una cuenta para guardar tus datos, agilizar reservas y actualizar tu perfil cuando lo necesites.
                </p>
                <ul class="auth-benefits">
                  <li>Reserva citas más rápido con datos prellenados</li>
                  <li>Edita nombre, teléfono y correo en cualquier momento</li>
                  <li>Misma cuenta en todas las sedes del centro</li>
                </ul>
                <a routerLink="/" class="btn btn-outline-light btn-sm mt-auto align-self-start">Volver al inicio</a>
              </aside>
            </div>

            <div class="col-lg-6 col-xl-5">
              <div class="auth-card cop-card">
                <header class="auth-card-head">
                  <span class="cop-section-eyebrow">{{ mode() === 'login' ? 'Ingreso' : 'Registro' }}</span>
                  <h2 class="cop-section-title text-start mb-1">
                    {{ mode() === 'login' ? 'Inicia sesión' : 'Crea tu cuenta' }}
                  </h2>
                  <p class="cop-section-copy text-start mb-0">
                    @if (mode() === 'login') {
                      Usa el correo y la contraseña con los que te registraste.
                    } @else {
                      Completa el formulario. Mínimo 8 caracteres en la contraseña.
                    }
                  </p>
                </header>

                <div class="auth-tabs" role="tablist">
                  <a
                    routerLink="/login"
                    class="auth-tab"
                    [class.auth-tab-active]="mode() === 'login'"
                    [queryParams]="returnUrl() ? { returnUrl: returnUrl() } : {}"
                    queryParamsHandling="merge">
                    Iniciar sesión
                  </a>
                  <a
                    routerLink="/register"
                    class="auth-tab"
                    [class.auth-tab-active]="mode() === 'register'"
                    [queryParams]="returnUrl() ? { returnUrl: returnUrl() } : {}"
                    queryParamsHandling="merge">
                    Registrarse
                  </a>
                </div>

                @if (successMessage()) {
                  <div class="alert alert-success mt-3 mb-0 py-2 small" role="status">{{ successMessage() }}</div>
                }
                @if (errorMessage()) {
                  <div class="alert alert-danger mt-3 mb-0 py-2 small" role="alert">{{ errorMessage() }}</div>
                }

                @if (sitesLoading()) {
                  <p class="form-text d-flex align-items-center gap-2 mt-3 mb-0">
                    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    Cargando sedes…
                  </p>
                }
                @if (sitesLoadError()) {
                  <div class="alert alert-warning mt-3 mb-0 py-2 small" role="alert">
                    {{ sitesLoadError() }}
                    <button type="button" class="btn btn-link btn-sm p-0 ms-1" (click)="loadSites()">Reintentar</button>
                  </div>
                }

                @if (mode() === 'login') {
                  <form class="auth-form row g-3" [formGroup]="loginForm" (ngSubmit)="submitLogin()">
                    <div class="col-12">
                      <label class="form-label" for="login-email">Correo electrónico</label>
                      <input
                        id="login-email"
                        type="email"
                        class="form-control"
                        formControlName="email"
                        autocomplete="email"
                        [class.is-invalid]="loginInvalid('email')" />
                      @if (loginInvalid('email')) {
                        <div class="invalid-feedback">Ingresa un correo válido.</div>
                      }
                    </div>
                    <div class="col-12">
                      <label class="form-label" for="login-password">Contraseña</label>
                      <input
                        id="login-password"
                        type="password"
                        class="form-control"
                        formControlName="password"
                        autocomplete="current-password"
                        [class.is-invalid]="loginInvalid('password')" />
                      @if (loginInvalid('password')) {
                        <div class="invalid-feedback">La contraseña es obligatoria (mín. 8 caracteres).</div>
                      }
                    </div>
                    <div class="col-12">
                      <label class="form-label" for="login-site-search">Buscar sede</label>
                      <input
                        id="login-site-search"
                        class="form-control mb-2"
                        placeholder="Nombre, municipio o departamento…"
                        [value]="siteSearch()"
                        (input)="onSiteSearch($event)" />
                      <label class="form-label" for="login-site">Sede</label>
                      <select
                        id="login-site"
                        class="form-select"
                        formControlName="siteId"
                        [class.is-invalid]="loginInvalid('siteId')"
                        [disabled]="sitesLoading()">
                        <option value="">Seleccione una sede</option>
                        @for (s of filteredSites(); track s.id) {
                          <option [value]="s.id">
                            {{ s.name }}@if (s.municipality) { · {{ s.municipality }} }
                          </option>
                        }
                      </select>
                      <div class="form-text">{{ filteredSites().length }} sedes visibles</div>
                      @if (loginInvalid('siteId')) {
                        <div class="invalid-feedback d-block">Selecciona una sede.</div>
                      }
                    </div>
                    <div class="col-12">
                      <button type="submit" class="btn btn-primary w-100" [disabled]="loginForm.invalid || busy() || sitesLoading()">
                        @if (busy()) {
                          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                        }
                        Ingresar
                      </button>
                    </div>
                  </form>
                } @else {
                  <form class="auth-form row g-3" [formGroup]="registerForm" (ngSubmit)="submitRegister()">
                    <div class="col-12">
                      <label class="form-label" for="reg-site-search">Buscar sede</label>
                      <input
                        id="reg-site-search"
                        class="form-control mb-2"
                        placeholder="Nombre, municipio o departamento…"
                        [value]="siteSearch()"
                        (input)="onSiteSearch($event)" />
                      <label class="form-label" for="reg-site">Sede de atención</label>
                      <select
                        id="reg-site"
                        class="form-select"
                        formControlName="siteId"
                        [class.is-invalid]="registerInvalid('siteId')"
                        [disabled]="sitesLoading()">
                        <option value="">Seleccione una sede</option>
                        @for (s of filteredSites(); track s.id) {
                          <option [value]="s.id">
                            {{ s.name }}@if (s.municipality) { · {{ s.municipality }} }
                          </option>
                        }
                      </select>
                      @if (registerInvalid('siteId')) {
                        <div class="invalid-feedback d-block">Selecciona una sede.</div>
                      }
                    </div>
                    <div class="col-12">
                      <label class="form-label" for="reg-name">Nombre completo</label>
                      <input
                        id="reg-name"
                        class="form-control"
                        formControlName="fullName"
                        autocomplete="name"
                        [class.is-invalid]="registerInvalid('fullName')" />
                      @if (registerInvalid('fullName')) {
                        <div class="invalid-feedback">Mínimo 3 caracteres.</div>
                      }
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="reg-email">Correo</label>
                      <input
                        id="reg-email"
                        type="email"
                        class="form-control"
                        formControlName="email"
                        autocomplete="email"
                        [class.is-invalid]="registerInvalid('email')" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="reg-phone">Teléfono</label>
                      <input id="reg-phone" class="form-control" formControlName="phone" autocomplete="tel" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="reg-password">Contraseña</label>
                      <input
                        id="reg-password"
                        type="password"
                        class="form-control"
                        formControlName="password"
                        autocomplete="new-password"
                        [class.is-invalid]="registerInvalid('password')" />
                      @if (registerInvalid('password')) {
                        <div class="invalid-feedback">Mínimo 8 caracteres.</div>
                      }
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="reg-birth">Fecha de nacimiento</label>
                      <input id="reg-birth" type="date" class="form-control" formControlName="birthDate" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="reg-gender">Género</label>
                      <select id="reg-gender" class="form-select" formControlName="gender">
                        <option value="">Prefiero no decir</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                    <div class="col-12">
                      <button type="submit" class="btn btn-primary w-100" [disabled]="registerForm.invalid || busy() || sitesLoading()">
                        @if (busy()) {
                          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                        }
                        Crear cuenta
                      </button>
                    </div>
                  </form>
                }

                <p class="auth-footer-note text-center text-muted small mb-0 mt-3">
                  ¿Eres profesional del centro?
                  <a [href]="dashboardLoginUrl" class="fw-semibold">Ingreso al panel clínico</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <app-public-site-footer />
    </div>
  `,
  styles: `
    .auth-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background:
        radial-gradient(ellipse 70% 45% at 0% 0%, rgba(13, 110, 106, 0.07), transparent 55%),
        var(--cop-surface, #faf9f7);
    }

    .auth-section {
      flex: 1;
      padding: clamp(2rem, 5vw, 4rem) 0;
    }

    .auth-aside {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      background: linear-gradient(165deg, var(--cop-brand-dark, #0a5855) 0%, #0f1c1e 55%);
      color: #fff;
      border: none;
    }

    .auth-aside .cop-section-eyebrow {
      background: rgba(255, 255, 255, 0.12);
      color: #e6f4f3;
    }

    .auth-aside-title {
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 700;
      line-height: 1.2;
      margin: 1rem 0 0.75rem;
      letter-spacing: -0.03em;
    }

    .auth-aside-copy {
      color: rgba(255, 255, 255, 0.78);
      margin-bottom: 1.25rem;
    }

    .auth-benefits {
      list-style: none;
      padding: 0;
      margin: 0 0 1.5rem;
      display: grid;
      gap: 0.65rem;
      color: rgba(255, 255, 255, 0.88);
      font-size: 0.95rem;
    }

    .auth-benefits li::before {
      content: "✓";
      color: #a7e0dc;
      margin-right: 0.5rem;
      font-weight: 700;
    }

    .auth-card {
      padding: clamp(1.25rem, 3vw, 2rem);
    }

    .auth-card-head .cop-section-title {
      margin-top: 0.5rem;
    }

    .auth-tabs {
      display: flex;
      gap: 0.35rem;
      margin-top: 1.25rem;
      padding: 0.3rem;
      border-radius: var(--cop-radius-pill);
      background: var(--cop-brand-light, #e6f4f3);
      border: 1px solid var(--cop-border);
    }

    .auth-tab {
      flex: 1;
      text-align: center;
      padding: 0.55rem 0.75rem;
      border-radius: var(--cop-radius-pill);
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--cop-ink-muted);
      text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    }

    .auth-tab-active {
      background: var(--cop-surface-elevated);
      color: var(--cop-brand-dark);
      box-shadow: var(--cop-shadow-sm);
    }

    .auth-form {
      margin-top: 1.25rem;
    }
  `,
})
export class PublicAuthPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly booking = inject(PublicBookingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly dashboardLoginUrl = `${DASHBOARD_URL}/login`;

  readonly mode = signal<'login' | 'register'>('login');
  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly returnUrl = signal('');
  readonly siteSearch = signal('');
  readonly sites = signal<PublicSiteVm[]>([]);
  readonly sitesLoading = signal(true);
  readonly sitesLoadError = signal('');

  readonly filteredSites = computed(() => {
    const q = this.siteSearch().trim().toLowerCase();
    const list = this.sites();
    if (!q) return list;
    return list.filter((s) => {
      const haystack = [s.name, s.municipality, s.department].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  });

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    siteId: ['', Validators.required],
  });

  readonly registerForm = this.fb.nonNullable.group({
    siteId: ['', Validators.required],
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    birthDate: [''],
    gender: ['' as '' | 'M' | 'F' | 'O'],
  });

  ngOnInit(): void {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    this.mode.set(path === 'register' ? 'register' : 'login');

    this.route.queryParamMap.subscribe((params) => {
      this.returnUrl.set(params.get('returnUrl') ?? '');
    });

    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl(this.returnUrl() || '/account');
      return;
    }

    this.loadSites();
  }

  protected loadSites(): void {
    this.sitesLoading.set(true);
    this.sitesLoadError.set('');
    this.booking.listSites$().subscribe({
      next: (sites) => {
        this.sites.set(sites ?? []);
        this.sitesLoading.set(false);
        const first = sites?.[0]?.id;
        if (first) {
          if (!this.loginForm.controls.siteId.value) this.loginForm.patchValue({ siteId: first });
          if (!this.registerForm.controls.siteId.value) this.registerForm.patchValue({ siteId: first });
        }
      },
      error: (err) => {
        this.sitesLoading.set(false);
        this.sitesLoadError.set(extractHttpErrorMessage(err, 'No pudimos cargar las sedes.'));
      },
    });
  }

  protected onSiteSearch(event: Event): void {
    this.siteSearch.set((event.target as HTMLInputElement).value);
  }

  protected loginInvalid(name: 'email' | 'password' | 'siteId'): boolean {
    const c = this.loginForm.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected registerInvalid(name: 'siteId' | 'fullName' | 'email' | 'password'): boolean {
    const c = this.registerForm.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errorMessage.set('');
    const v = this.loginForm.getRawValue();
    this.auth.login$({ email: v.email, password: v.password, siteId: v.siteId }).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl(this.returnUrl() || '/account');
      },
      error: (err) => {
        this.busy.set(false);
        this.errorMessage.set(extractHttpErrorMessage(err, 'No pudimos iniciar sesión. Revisa correo, contraseña y sede.'));
      },
    });
  }

  protected submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errorMessage.set('');
    const v = this.registerForm.getRawValue();
    this.auth
      .register$({
        siteId: v.siteId,
        email: v.email,
        password: v.password,
        fullName: v.fullName,
        phone: v.phone || undefined,
        birthDate: v.birthDate || undefined,
        gender: v.gender || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.successMessage.set('Cuenta creada correctamente. Redirigiendo…');
          setTimeout(() => void this.router.navigateByUrl(this.returnUrl() || '/account'), 800);
        },
        error: (err) => {
          this.busy.set(false);
          this.errorMessage.set(extractHttpErrorMessage(err, 'No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo.'));
        },
      });
  }
}
