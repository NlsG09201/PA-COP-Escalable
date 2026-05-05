import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PublicBookingService } from './data-access/public-booking.service';
import { Observable, combineLatest, map, of } from 'rxjs';

@Component({
  selector: 'app-public-account-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section-block">
      <div class="container">
        <div class="row g-4 align-items-start">
          <div class="col-lg-7">
            <div class="cardx">
              <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <span class="eyebrow">Cuenta</span>
                  <h2 class="h3 mt-2 mb-1">Tu perfil</h2>
                  <p class="text-muted mb-0">Regístrate, inicia sesión y edita tus datos cuando lo necesites.</p>
                </div>
                <a routerLink="/" class="btn btn-outline-secondary btn-sm">Volver</a>
              </div>

              @if (!(me$ | async)) {
                <div class="tabs">
                  <button type="button" class="tab" [class.active]="mode() === 'login'" (click)="mode.set('login')">Ingresar</button>
                  <button type="button" class="tab" [class.active]="mode() === 'register'" (click)="mode.set('register')">Crear cuenta</button>
                </div>

                @if (mode() === 'login') {
                  <form class="row g-3 mt-3" [formGroup]="loginForm" (ngSubmit)="doLogin()">
                    <div class="col-md-6">
                      <label class="form-label">Correo</label>
                      <input class="form-control" formControlName="email" placeholder="tu@gmail.com" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Contraseña</label>
                      <input class="form-control" type="password" formControlName="password" />
                    </div>
                    <div class="col-12">
                      <label class="form-label">Sede</label>
                      <select class="form-select" formControlName="siteId">
                        @for (s of sites$ | async; track s.id) {
                          <option [value]="s.id">{{ s.name }}</option>
                        }
                      </select>
                      <div class="form-text">Se usa para asociar tu perfil a la clínica/sede.</div>
                    </div>
                    <div class="col-12 d-flex justify-content-end">
                      <button class="btn btn-primary" [disabled]="loginForm.invalid || busy()">Ingresar</button>
                    </div>
                  </form>
                } @else {
                  <form class="row g-3 mt-3" [formGroup]="registerForm" (ngSubmit)="doRegister()">
                    <div class="col-12">
                      <label class="form-label">Sede</label>
                      <select class="form-select" formControlName="siteId">
                        @for (s of sites$ | async; track s.id) {
                          <option [value]="s.id">{{ s.name }}</option>
                        }
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Nombre completo</label>
                      <input class="form-control" formControlName="fullName" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Teléfono</label>
                      <input class="form-control" formControlName="phone" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Correo</label>
                      <input class="form-control" formControlName="email" placeholder="tu@hotmail.com" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Contraseña</label>
                      <input class="form-control" type="password" formControlName="password" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Fecha de nacimiento</label>
                      <input class="form-control" type="date" formControlName="birthDate" />
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Género</label>
                      <select class="form-select" formControlName="gender">
                        <option value="">Prefiero no decir</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                    <div class="col-12 d-flex justify-content-end">
                      <button class="btn btn-primary" [disabled]="registerForm.invalid || busy()">Crear cuenta</button>
                    </div>
                  </form>
                }
              } @else {
                <div class="alertx">
                  Sesión iniciada como <strong>{{ (me$ | async)?.username }}</strong>
                </div>

                <form class="row g-3 mt-2" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                  <div class="col-md-6">
                    <label class="form-label">Nombre completo</label>
                    <input class="form-control" formControlName="fullName" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Teléfono</label>
                    <input class="form-control" formControlName="phone" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Correo</label>
                    <input class="form-control" formControlName="email" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Nueva contraseña (opcional)</label>
                    <input class="form-control" type="password" formControlName="password" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Fecha de nacimiento</label>
                    <input class="form-control" type="date" formControlName="birthDate" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Género</label>
                    <select class="form-select" formControlName="gender">
                      <option value="">Prefiero no decir</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro</option>
                    </select>
                  </div>
                  <div class="col-12 d-flex justify-content-between align-items-center gap-2">
                    <button type="button" class="btn btn-outline-danger" (click)="logout()" [disabled]="busy()">Cerrar sesión</button>
                    <button class="btn btn-primary" [disabled]="profileForm.invalid || busy()">Guardar cambios</button>
                  </div>
                </form>
              }
            </div>
          </div>

          <div class="col-lg-5">
            <div class="cardx">
              <span class="eyebrow">Tip</span>
              <h3 class="h5 mt-2">¿Por qué crear cuenta?</h3>
              <ul class="mb-0 text-muted">
                <li>Editar datos si te equivocaste al reservar</li>
                <li>Ver tu perfil y usar el mismo correo en futuras reservas</li>
                <li>Más control y trazabilidad de tu información</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .section-block { padding: 2rem 0 4rem; }
    .cardx {
      border-radius: 1.6rem;
      padding: 1.5rem;
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(148,163,184,0.14);
      box-shadow: 0 20px 45px rgba(15,23,42,0.06);
    }
    .eyebrow{
      display:inline-flex;align-items:center;border-radius:999px;padding:.35rem .75rem;
      font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
      background:#ede9fe;color:#6d28d9;
    }
    .tabs{display:flex;gap:.5rem;background:#f1f5f9;border:1px solid rgba(148,163,184,.18);padding:.35rem;border-radius:999px;margin-top:1rem;}
    .tab{border:0;background:transparent;padding:.55rem .9rem;border-radius:999px;font-weight:900;color:#475569}
    .tab.active{background:#fff;box-shadow:0 10px 24px rgba(15,23,42,.06);color:#0f172a}
    .alertx{margin-top:1rem;border-radius:1rem;padding:0.85rem 1rem;background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;font-weight:700;}
  `
})
export class PublicAccountPageComponent implements OnInit {
  mode = signal<'login' | 'register'>('login');
  busy = signal(false);

  sites$!: Observable<any[]>;
  me$!: Observable<any>;

  loginForm!: FormGroup;
  registerForm!: FormGroup;
  profileForm!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly publicBooking: PublicBookingService,
  ) {
    this.sites$ = this.publicBooking.listSites$();
    this.me$ = this.auth.current$();

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      siteId: ['', [Validators.required]],
    });

    this.registerForm = this.fb.group({
      siteId: ['', [Validators.required]],
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      birthDate: [''],
      gender: [''],
    });

    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      birthDate: [''],
      gender: [''],
    });
  }

  ngOnInit(): void {
    // Best-effort: if token exists load me.
    if (this.auth.isLoggedIn()) this.auth.loadMe$().subscribe();

    combineLatest([this.me$, of(null)]).pipe(map(([me]) => me)).subscribe((me) => {
      const p = me?.profile;
      if (!p) return;
      this.profileForm.patchValue({
        fullName: p.fullName ?? '',
        phone: p.phone ?? '',
        email: p.email ?? me?.username ?? '',
        birthDate: p.birthDate ?? '',
        gender: p.gender ?? '',
        password: '',
      });
    });
  }

  doLogin(): void {
    if (this.loginForm.invalid) return;
    this.busy.set(true);
    const v = this.loginForm.getRawValue();
    this.auth.login$({ email: v.email!, password: v.password!, siteId: v.siteId! }).subscribe({
      next: () => this.busy.set(false),
      error: () => this.busy.set(false),
    });
  }

  doRegister(): void {
    if (this.registerForm.invalid) return;
    this.busy.set(true);
    const v = this.registerForm.getRawValue();
    this.auth
      .register$({
        siteId: v.siteId!,
        email: v.email!,
        password: v.password!,
        fullName: v.fullName!,
        phone: v.phone || undefined,
        birthDate: v.birthDate || undefined,
        gender: (v.gender as any) || undefined,
      })
      .subscribe({
        next: () => this.busy.set(false),
        error: () => this.busy.set(false),
      });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.busy.set(true);
    const v = this.profileForm.getRawValue();
    this.auth
      .updateMe$({
        fullName: v.fullName!,
        phone: v.phone || undefined,
        email: v.email || undefined,
        birthDate: v.birthDate || undefined,
        gender: (v.gender as any) || undefined,
        password: v.password || undefined,
      })
      .subscribe({
        next: () => this.busy.set(false),
        error: () => this.busy.set(false),
      });
  }

  logout(): void {
    this.busy.set(true);
    this.auth.logout$().subscribe({ next: () => this.busy.set(false), error: () => this.busy.set(false) });
  }
}

