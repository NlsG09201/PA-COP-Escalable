import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import * as echarts from 'echarts';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  BudgetApiService,
  ClinicalBudget,
  BudgetPhase,
  PaymentSimulation,
} from '../../core/services/budget-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0 fw-bold">
          <i class="bi bi-cash-stack me-2 text-primary"></i>Presupuestos
        </h4>
        @if (!patientId()) {
          <span class="badge text-bg-warning">Seleccione un paciente</span>
        } @else {
          <button
            class="btn btn-primary btn-sm"
            [disabled]="generating()"
            (click)="generateBudget()"
          >
            @if (generating()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            <i class="bi bi-plus-circle me-1"></i>Generar Presupuesto
          </button>
        }
      </div>

      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle"></i>
          Seleccione un paciente para gestionar presupuestos clinicos.
        </div>
      } @else {
        @if (error()) {
          <div class="alert alert-danger">{{ error() }}</div>
        }

        <div class="row g-4">
          <!-- Budget List -->
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6 class="card-title mb-3">Presupuestos del Paciente</h6>

                @if (loading()) {
                  <div class="text-center py-4">
                    <div class="spinner-border text-primary"></div>
                  </div>
                } @else if (budgets().length === 0) {
                  <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox display-4"></i>
                    <p class="mt-2">No hay presupuestos generados.</p>
                  </div>
                } @else {
                  @for (budget of budgets(); track budget.id) {
                    <div
                      class="budget-card p-3 rounded-3 mb-3"
                      [class.active]="
                        selectedBudget() && selectedBudget()!.id === budget.id
                      "
                      (click)="selectBudget(budget)"
                      role="button"
                    >
                      <div
                        class="d-flex justify-content-between align-items-start mb-2"
                      >
                        <div>
                          <div class="fw-semibold">
                            Presupuesto #{{ budget.id.slice(0, 8) }}
                          </div>
                          <small class="text-muted">{{
                            budget.createdAt | date: 'dd/MM/yyyy'
                          }}</small>
                        </div>
                        <span
                          class="badge rounded-pill"
                          [class]="statusBadge(budget.status)"
                          >{{ budget.status }}</span
                        >
                      </div>
                      <div class="d-flex justify-content-between">
                        <small class="text-muted"
                          >{{ budget.phases.length }} fases</small
                        >
                        <strong class="text-primary">{{
                          formatCurrency(budget.totalAmount)
                        }}</strong>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </div>

          <!-- Budget Detail + Payment Simulator -->
          <div class="col-lg-7">
            @if (selectedBudget()) {
              <!-- Detail: Phases Accordion -->
              <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                  <div
                    class="d-flex justify-content-between align-items-center mb-3"
                  >
                    <h6 class="card-title mb-0">Detalle del Presupuesto</h6>
                    @if (selectedBudget()!.status !== 'APPROVED') {
                      <button
                        class="btn btn-sm btn-success"
                        [disabled]="approving()"
                        (click)="approveBudget()"
                      >
                        @if (approving()) {
                          <span
                            class="spinner-border spinner-border-sm me-1"
                          ></span>
                        }
                        <i class="bi bi-check-circle me-1"></i>Aprobar
                      </button>
                    }
                  </div>

                  <div class="accordion" id="phasesAccordion">
                    @for (
                      phase of selectedBudget()!.phases;
                      track phase.id;
                      let idx = $index
                    ) {
                      <div class="accordion-item border-0 mb-2">
                        <h2 class="accordion-header">
                          <button
                            class="accordion-button collapsed bg-light rounded"
                            type="button"
                            (click)="togglePhase(idx)"
                          >
                            <div
                              class="d-flex justify-content-between w-100 me-3"
                            >
                              <span class="fw-semibold">{{
                                phase.phaseName
                              }}</span>
                              <span class="text-primary fw-bold">{{
                                formatCurrency(phase.phaseTotal)
                              }}</span>
                            </div>
                          </button>
                        </h2>
                        @if (expandedPhase() === idx) {
                          <div class="accordion-collapse show">
                            <div class="accordion-body p-0 pt-2">
                              <div class="table-responsive">
                                <table
                                  class="table table-sm table-hover mb-0"
                                >
                                  <thead class="table-light">
                                    <tr>
                                      <th>Descripcion</th>
                                      <th class="text-center">Cant.</th>
                                      <th class="text-end">C. Unit.</th>
                                      <th class="text-end">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    @for (
                                      item of phase.items;
                                      track item.id
                                    ) {
                                      <tr>
                                        <td>
                                          <span class="small">{{
                                            item.description
                                          }}</span>
                                          @if (item.category) {
                                            <span
                                              class="badge text-bg-light ms-1 small"
                                              >{{ item.category }}</span
                                            >
                                          }
                                        </td>
                                        <td class="text-center">
                                          {{ item.quantity }}
                                        </td>
                                        <td class="text-end">
                                          {{ formatCurrency(item.unitCost) }}
                                        </td>
                                        <td class="text-end fw-semibold">
                                          {{ formatCurrency(item.subtotal) }}
                                        </td>
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <div
                    class="d-flex justify-content-end mt-3 pt-3 border-top"
                  >
                    <div class="text-end">
                      <small class="text-muted d-block">Total General</small>
                      <h5 class="text-primary mb-0">
                        {{ formatCurrency(selectedBudget()!.totalAmount) }}
                      </h5>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ECharts Pie -->
              <div class="card border-0 shadow-sm mb-4">
                <div class="card-body">
                  <h6 class="card-title mb-3">Distribucion por Fase</h6>
                  <div
                    #pieChart
                    style="width: 100%; height: 280px"
                  ></div>
                </div>
              </div>

              <!-- Payment Simulator -->
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">
                    <i class="bi bi-calculator me-2"></i>Simulador de Pagos
                  </h6>

                  <div class="row g-3 mb-3">
                    <div class="col-md-4">
                      <label class="form-label small fw-semibold"
                        >Tipo de Plan</label
                      >
                      <select
                        class="form-select form-select-sm"
                        [(ngModel)]="planType"
                      >
                        <option value="CASH">Contado</option>
                        <option value="INSTALLMENTS">Cuotas</option>
                        <option value="INSURANCE">Seguro</option>
                      </select>
                    </div>
                    <div class="col-md-4">
                      <label class="form-label small fw-semibold"
                        >Cuotas: {{ installmentCount }}</label
                      >
                      <input
                        type="range"
                        class="form-range"
                        min="1"
                        max="24"
                        [(ngModel)]="installmentCount"
                      />
                    </div>
                    <div class="col-md-4">
                      <label class="form-label small fw-semibold"
                        >Interes (%)</label
                      >
                      <input
                        type="number"
                        class="form-control form-control-sm"
                        [(ngModel)]="interestRate"
                        min="0"
                        max="100"
                        step="0.5"
                      />
                    </div>
                  </div>

                  <button
                    class="btn btn-outline-primary btn-sm mb-3"
                    [disabled]="simulating()"
                    (click)="simulatePayment()"
                  >
                    @if (simulating()) {
                      <span
                        class="spinner-border spinner-border-sm me-1"
                      ></span>
                    }
                    Simular
                  </button>

                  @if (paymentResult()) {
                    <div class="mb-3 p-3 bg-light rounded">
                      <div class="row text-center">
                        <div class="col">
                          <small class="text-muted d-block"
                            >Total sin interes</small
                          >
                          <strong>{{
                            formatCurrency(selectedBudget()!.totalAmount)
                          }}</strong>
                        </div>
                        <div class="col">
                          <small class="text-muted d-block"
                            >Total con interes</small
                          >
                          <strong class="text-danger">{{
                            formatCurrency(
                              paymentResult()!.totalWithInterest
                            )
                          }}</strong>
                        </div>
                        @if (planType === 'CASH') {
                          <div class="col">
                            <small class="text-muted d-block"
                              >Descuento contado</small
                            >
                            <strong class="text-success">
                              {{
                                formatCurrency(
                                  selectedBudget()!.totalAmount -
                                    paymentResult()!.totalWithInterest
                                )
                              }}
                            </strong>
                          </div>
                        }
                      </div>
                    </div>

                    @if (paymentResult()!.installments.length > 1) {
                      <div class="table-responsive">
                        <table class="table table-sm table-hover">
                          <thead class="table-light">
                            <tr>
                              <th>#</th>
                              <th>Monto</th>
                              <th>Fecha Vencimiento</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (
                              inst of paymentResult()!.installments;
                              track inst.installmentNumber
                            ) {
                              <tr>
                                <td>{{ inst.installmentNumber }}</td>
                                <td class="fw-semibold">
                                  {{ formatCurrency(inst.amount) }}
                                </td>
                                <td>
                                  {{
                                    inst.dueDate | date: 'dd/MM/yyyy'
                                  }}
                                </td>
                                <td>
                                  <span
                                    class="badge rounded-pill"
                                    [class]="
                                      installmentBadge(inst.status)
                                    "
                                    >{{ inst.status }}</span
                                  >
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  }
                </div>
              </div>
            } @else {
              <div
                class="card border-0 shadow-sm d-flex align-items-center justify-content-center"
                style="min-height: 400px"
              >
                <div class="text-center text-muted">
                  <i class="bi bi-receipt display-4"></i>
                  <p class="mt-2">
                    Seleccione un presupuesto para ver el detalle
                  </p>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .budget-card {
        background: #f8f9fa;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .budget-card:hover {
        background: #e9ecef;
      }
      .budget-card.active {
        border-color: #0d6efd;
        background: #e8f0fe;
      }
      .accordion-button:not(.collapsed) {
        background-color: #e8f0fe;
        color: #0d6efd;
      }
    `,
  ],
})
class BudgetPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pieChart') private pieChartRef?: ElementRef<HTMLDivElement>;

  private readonly store = inject(Store);
  private readonly budgetApi = inject(BudgetApiService);
  private sub?: Subscription;
  private chart?: echarts.ECharts;

  protected readonly patientId = signal<string | null>(null);
  protected readonly budgets = signal<ClinicalBudget[]>([]);
  protected readonly selectedBudget = signal<ClinicalBudget | null>(null);
  protected readonly loading = signal(false);
  protected readonly generating = signal(false);
  protected readonly approving = signal(false);
  protected readonly simulating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedPhase = signal<number | null>(null);
  protected readonly paymentResult = signal<PaymentSimulation | null>(null);

  protected planType = 'INSTALLMENTS';
  protected installmentCount = 6;
  protected interestRate = 0;

  ngOnInit(): void {
    this.sub = this.store.select(selectSelectedPatientId).subscribe((id) => {
      this.patientId.set(id);
      if (id) this.loadBudgets(id);
    });
  }

  ngAfterViewInit(): void {
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    window.removeEventListener('resize', this.onResize);
    this.chart?.dispose();
  }

  protected selectBudget(budget: ClinicalBudget): void {
    this.selectedBudget.set(budget);
    this.expandedPhase.set(null);
    this.paymentResult.set(null);
    setTimeout(() => this.renderPieChart(), 50);
  }

  protected togglePhase(idx: number): void {
    this.expandedPhase.update((v) => (v === idx ? null : idx));
  }

  protected generateBudget(): void {
    const pid = this.patientId();
    if (!pid) return;
    this.generating.set(true);
    this.error.set(null);

    this.budgetApi
      .generateGeneric$(pid, {
        name: 'Presupuesto (manual)',
        phases: [],
      })
      .subscribe({
      next: () => {
        this.generating.set(false);
        this.loadBudgets(pid);
      },
      error: (err) => {
        this.generating.set(false);
        this.error.set(err?.error?.message ?? 'Error al generar presupuesto');
      },
    });
  }

  protected approveBudget(): void {
    const budget = this.selectedBudget();
    if (!budget) return;
    this.approving.set(true);

    this.budgetApi.approveBudget$(budget.id).subscribe({
      next: (updated) => {
        this.approving.set(false);
        this.selectedBudget.set(updated);
        const pid = this.patientId();
        if (pid) this.loadBudgets(pid);
      },
      error: () => this.approving.set(false),
    });
  }

  protected simulatePayment(): void {
    const budget = this.selectedBudget();
    if (!budget) return;
    this.simulating.set(true);

    this.budgetApi
      .simulatePayment$(budget.id, this.planType, this.installmentCount, this.interestRate)
      .subscribe({
        next: (result) => {
          this.paymentResult.set(result);
          this.simulating.set(false);
        },
        error: () => this.simulating.set(false),
      });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected statusBadge(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'text-bg-success';
      case 'PENDING':
        return 'text-bg-warning';
      case 'REJECTED':
        return 'text-bg-danger';
      default:
        return 'text-bg-secondary';
    }
  }

  protected installmentBadge(status: string): string {
    switch (status) {
      case 'PAID':
        return 'text-bg-success';
      case 'PENDING':
        return 'text-bg-warning';
      case 'OVERDUE':
        return 'text-bg-danger';
      default:
        return 'text-bg-secondary';
    }
  }

  private readonly onResize = (): void => {
    this.chart?.resize();
  };

  private loadBudgets(patientId: string): void {
    this.loading.set(true);
    this.budgetApi.getBudgets$(patientId).subscribe({
      next: (budgets) => {
        this.budgets.set(budgets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private renderPieChart(): void {
    const budget = this.selectedBudget();
    if (!budget || !this.pieChartRef) return;

    if (!this.chart) {
      this.chart = echarts.init(this.pieChartRef.nativeElement);
    }

    const data = budget.phases.map((p) => ({
      name: p.phaseName,
      value: p.phaseTotal,
    }));

    this.chart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (params: any) =>
          `${params.name}: ${this.formatCurrency(params.value)} (${params.percent}%)`,
      },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontWeight: 'bold' },
          },
          data,
        },
      ],
    });
    this.chart.resize();
  }
}

export const BUDGET_ROUTES: Routes = [
  { path: '', component: BudgetPageComponent },
];
