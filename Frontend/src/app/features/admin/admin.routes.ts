import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { AdminApiService, AdminSiteVm, AdminUserVm } from '../../core/services/admin-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="row g-4">
      <div class="col-lg-5">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h5 class="card-title">Asignar rol clínico</h5>
            <p class="text-muted small">
              El usuario debe haberse registrado antes en la web pública. Solo tú (admin) puedes promoverlo a médico.
            </p>

            <label class="form-label">Buscar usuario</label>
            <div class="input-group mb-2">
              <input class="form-control" [(ngModel)]="userSearch" (keyup.enter)="searchUsers()" placeholder="correo o usuario" />
              <button class="btn btn-outline-secondary" type="button" (click)="searchUsers()" [disabled]="loadingUsers()">Buscar</button>
            </div>

            @if (users().length) {
              <div class="list-group mb-3" style="max-height: 180px; overflow-y: auto;">
                @for (u of users(); track u.id) {
                  <button type="button" class="list-group-item list-group-item-action" [class.active]="selectedUsername === u.username" (click)="selectUser(u)">
                    <strong>{{ u.username }}</strong>
                    <small class="d-block text-muted">{{ u.roles.join(', ') || 'sin roles' }}</small>
                  </button>
                }
              </div>
            }

            <label class="form-label">Usuario seleccionado</label>
            <input class="form-control mb-2" [(ngModel)]="selectedUsername" placeholder="ej. doctor@gmail.com" />

            <label class="form-label">Rol a asignar</label>
            <select class="form-select mb-3" [(ngModel)]="selectedRole">
              <option value="MEDICO">Médico / Doctor</option>
              <option value="PROFESSIONAL">Profesional</option>
              <option value="PACIENTE">Paciente (revertir)</option>
            </select>

            <button class="btn btn-primary w-100" type="button" (click)="assignRole()" [disabled]="!selectedUsername || assigning()">
              {{ assigning() ? 'Guardando...' : 'Asignar rol' }}
            </button>

            @if (assignMessage()) {
              <div class="alert mt-3 mb-0" [class.alert-success]="assignOk()" [class.alert-danger]="!assignOk()">{{ assignMessage() }}</div>
            }
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 class="card-title mb-0">Sedes registradas</h5>
                <p class="text-muted small mb-0">{{ sites().length }} sedes activas en el sistema</p>
              </div>
              <div class="d-flex gap-2">
                <select class="form-select form-select-sm" style="width: 200px;" [(ngModel)]="siteDeptFilter" (change)="applySiteFilter()">
                  <option value="">Todos los departamentos</option>
                  @for (d of siteDepartments(); track d) {
                    <option [value]="d">{{ d }}</option>
                  }
                </select>
                <button class="btn btn-outline-primary btn-sm" type="button" (click)="syncCatalog()" [disabled]="syncing()">
                  {{ syncing() ? 'Sincronizando...' : 'Sincronizar catálogo' }}
                </button>
                <button class="btn btn-outline-secondary btn-sm" type="button" (click)="loadSites()" [disabled]="loadingSites()">Actualizar</button>
              </div>
            </div>

            @if (syncMessage()) {
              <div class="alert alert-info py-2 small">{{ syncMessage() }}</div>
            }

            <div class="table-responsive" style="max-height: 420px;">
              <table class="table table-sm table-hover align-middle">
                <thead class="sticky-top bg-white">
                  <tr>
                    <th>Sede</th>
                    <th>Municipio</th>
                    <th>Departamento</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of filteredSites(); track s.id) {
                    <tr>
                      <td>{{ s.name }}</td>
                      <td>{{ s.municipality || '—' }}</td>
                      <td>{{ s.department || '—' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="3" class="text-center text-muted py-4">Sin sedes para el filtro actual.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
class AdminPageComponent {
  private readonly api = inject(AdminApiService);

  protected userSearch = '';
  protected selectedUsername = '';
  protected selectedRole: 'MEDICO' | 'PROFESSIONAL' | 'PACIENTE' = 'MEDICO';
  protected siteDeptFilter = '';

  protected readonly users = signal<AdminUserVm[]>([]);
  protected readonly sites = signal<AdminSiteVm[]>([]);
  protected readonly filteredSites = signal<AdminSiteVm[]>([]);
  protected readonly siteDepartments = signal<string[]>([]);
  protected readonly loadingUsers = signal(false);
  protected readonly loadingSites = signal(false);
  protected readonly assigning = signal(false);
  protected readonly syncing = signal(false);
  protected readonly assignMessage = signal('');
  protected readonly assignOk = signal(false);
  protected readonly syncMessage = signal('');

  constructor() {
    this.loadSites();
  }

  protected searchUsers(): void {
    this.loadingUsers.set(true);
    this.api.listUsers$(this.userSearch).subscribe({
      next: (rows) => {
        this.users.set(rows);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });
  }

  protected selectUser(u: AdminUserVm): void {
    this.selectedUsername = u.username;
  }

  protected assignRole(): void {
    this.assigning.set(true);
    this.assignMessage.set('');
    this.api.assignRole$(this.selectedUsername.trim().toLowerCase(), this.selectedRole).subscribe({
      next: (res) => {
        this.assignOk.set(true);
        this.assignMessage.set(res.message || 'Rol asignado.');
        this.assigning.set(false);
        this.searchUsers();
      },
      error: (err) => {
        this.assignOk.set(false);
        this.assignMessage.set(err?.error?.message ?? 'No se pudo asignar el rol.');
        this.assigning.set(false);
      },
    });
  }

  protected loadSites(): void {
    this.loadingSites.set(true);
    this.api.listSites$().subscribe({
      next: (rows) => {
        this.sites.set(rows);
        const deps = Array.from(
          new Set(rows.map((s) => s.department).filter((d): d is string => !!d)),
        ).sort((a, b) => a.localeCompare(b, 'es'));
        this.siteDepartments.set(deps);
        this.applySiteFilter();
        this.loadingSites.set(false);
      },
      error: () => this.loadingSites.set(false),
    });
  }

  protected applySiteFilter(): void {
    const dep = this.siteDeptFilter.trim();
    const all = this.sites();
    this.filteredSites.set(
      dep ? all.filter((s) => String(s.department ?? '').toLowerCase() === dep.toLowerCase()) : all,
    );
  }

  protected syncCatalog(): void {
    this.syncing.set(true);
    this.syncMessage.set('');
    this.api.syncSitesCatalog$().subscribe({
      next: (res) => {
        this.syncMessage.set(
          `Catálogo sincronizado: ${res.created} nuevas · ${res.totalActive} activas (esperadas ${res.catalogSize}).`,
        );
        this.syncing.set(false);
        this.loadSites();
      },
      error: () => {
        this.syncMessage.set('No se pudo sincronizar el catálogo.');
        this.syncing.set(false);
      },
    });
  }
}

export const ADMIN_ROUTES: Routes = [{ path: '', component: AdminPageComponent }];
