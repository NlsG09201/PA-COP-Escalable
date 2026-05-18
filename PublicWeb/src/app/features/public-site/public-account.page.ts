import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';
import { PublicSiteHeaderComponent } from './components/public-site-header.component';
import { PublicSiteFooterComponent } from './components/public-site-footer.component';
import { MeResponse } from '../../core/auth/auth.models';

@Component({
  selector: 'app-public-account-page',
  standalone: true,
  imports: [AsyncPipe, CommonModule, ReactiveFormsModule, RouterLink, PublicSiteHeaderComponent, PublicSiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="account-shell">
      <app-public-site-header />

      <section class="cop-section-block">
        <div class="container">
          <div class="row g-4 justify-content-center">
            <div class="col-lg-8 col-xl-7">
              <div class="account-card cop-card">
                <header class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                  <div>
                    <span class="cop-section-eyebrow">Mi cuenta</span>
                    <h1 class="cop-section-title text-start mb-1">Tu perfil</h1>
                    <p class="cop-section-copy text-start mb-0">Actualiza tus datos de contacto y contraseña.</p>
                  </div>
                  <a routerLink="/" class="btn btn-outline-secondary btn-sm">Inicio</a>
                </header>

                @if (me$ | async; as me) {
                  <div class="account-welcome mb-4">
                    Sesión activa:
                    <strong>{{ displayName(me) }}</strong>
                  </div>

                  @if (successMessage()) {
                    <div class="alert alert-success py-2 small" role="status">{{ successMessage() }}</div>
                  }
                  @if (errorMessage()) {
                    <div class="alert alert-danger py-2 small" role="alert">{{ errorMessage() }}</div>
                  }

                  <form class="row g-3" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                    <div class="col-md-6">
                      <label class="form-label" for="profile-name">Nombre completo</label>
                      <input id="profile-name" class="form-control" formControlName="fullName" autocomplete="name" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="profile-phone">Teléfono</label>
                      <input id="profile-phone" class="form-control" formControlName="phone" autocomplete="tel" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="profile-email">Correo</label>
                      <input id="profile-email" type="email" class="form-control" formControlName="email" autocomplete="email" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="profile-password">Nueva contraseña (opcional)</label>
                      <input id="profile-password" type="password" class="form-control" formControlName="password" autocomplete="new-password" />
                      <div class="form-text">Déjala vacía si no quieres cambiarla.</div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="profile-birth">Fecha de nacimiento</label>
                      <input id="profile-birth" type="date" class="form-control" formControlName="birthDate" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="profile-gender">Género</label>
                      <select id="profile-gender" class="form-select" formControlName="gender">
                        <option value="">Prefiero no decir</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                    <div class="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2">
                      <button type="button" class="btn btn-outline-danger" (click)="logout()" [disabled]="busy()">
                        Cerrar sesión
                      </button>
                      <div class="d-flex gap-2">
                        <a routerLink="/" fragment="booking" class="btn btn-outline-primary">Agendar cita</a>
                        <button type="submit" class="btn btn-primary" [disabled]="profileForm.invalid || busy()">
                          @if (busy()) {
                            <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                          }
                          Guardar cambios
                        </button>
                      </div>
                    </div>
                  </form>
                } @else {
                  <div class="text-center py-4 text-muted">
                    <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    Cargando perfil…
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <app-public-site-footer />
    </div>
  `,
  styles: `
    .account-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--cop-surface, #faf9f7);
    }

    .cop-section-block {
      flex: 1;
    }

    .account-card {
      padding: clamp(1.25rem, 3vw, 2rem);
    }

    .account-welcome {
      border-radius: var(--cop-radius-md);
      padding: 0.85rem 1rem;
      background: var(--cop-brand-light, #e6f4f3);
      color: var(--cop-brand-dark, #0a5855);
      font-size: 0.95rem;
    }
  `,
})
export class PublicAccountPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly me$ = this.auth.current$();

  readonly profileForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: [''],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    birthDate: [''],
    gender: ['' as '' | 'M' | 'F' | 'O'],
  });

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/account' } });
      return;
    }

    this.auth.loadMe$().subscribe((me) => {
      if (!me) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/account' } });
        return;
      }
      this.patchProfile(me);
    });

    this.me$.subscribe((me) => {
      if (me) this.patchProfile(me);
    });
  }

  protected displayName(me: MeResponse | null): string {
    if (!me) return '';
    return me.profile?.fullName?.trim() || me.username;
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const v = this.profileForm.getRawValue();
    this.auth
      .updateMe$({
        fullName: v.fullName,
        phone: v.phone || undefined,
        email: v.email || undefined,
        birthDate: v.birthDate || undefined,
        gender: v.gender || undefined,
        password: v.password || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.successMessage.set('Perfil actualizado correctamente.');
          this.profileForm.patchValue({ password: '' });
        },
        error: (err) => {
          this.busy.set(false);
          this.errorMessage.set(extractHttpErrorMessage(err, 'No pudimos guardar los cambios.'));
        },
      });
  }

  protected logout(): void {
    this.busy.set(true);
    this.auth.logout$().subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl('/');
      },
      error: () => {
        this.busy.set(false);
        void this.router.navigateByUrl('/');
      },
    });
  }

  private patchProfile(me: MeResponse): void {
    const p = me.profile;
    this.profileForm.patchValue({
      fullName: p?.fullName ?? '',
      phone: p?.phone ?? '',
      email: p?.email ?? me.username ?? '',
      birthDate: p?.birthDate ?? '',
      gender: p?.gender ?? '',
      password: '',
    });
  }
}
