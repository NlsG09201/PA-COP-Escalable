import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PublicReviewVm, PublicReviewsApiService } from '../data-access/public-reviews-api.service';

@Component({
  selector: 'app-public-reviews-section',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="reviews" class="reviews-section">
      <div class="container py-5">
        <div class="section-head mb-4">
          <span class="eyebrow">Opiniones</span>
          <h2 class="section-title mb-2">Lo que dicen las personas que nos visitan</h2>
          <p class="section-lead mb-0">
            Las reseñas públicas aparecen después de revisión moderada para mantener un espacio respetuoso y útil.
          </p>
        </div>

        <div class="row g-4">
          <div class="col-lg-5">
            <div class="review-form-card">
              <h3 class="h5 mb-3">Deja tu reseña</h3>

              @if (submitOk()) {
                <div class="alert alert-success small mb-3">{{ submitOk() }}</div>
              }
              @if (submitError()) {
                <div class="alert alert-danger small mb-3">{{ submitError() }}</div>
              }

              <form [formGroup]="form" (ngSubmit)="submit()">
                <div class="mb-3">
                  <label class="form-label">Nombre o iniciales</label>
                  <input class="form-control" formControlName="authorName" maxlength="80" autocomplete="name" />
                  @if (form.controls.authorName.touched && form.controls.authorName.invalid) {
                    <div class="form-text text-danger">Mínimo 2 caracteres.</div>
                  }
                </div>

                <div class="mb-3">
                  <label class="form-label">Calificación</label>
                  <select class="form-select" formControlName="rating">
                    @for (n of stars; track n) {
                      <option [ngValue]="n">{{ n }} — {{ starLabel(n) }}</option>
                    }
                  </select>
                </div>

                <div class="mb-3">
                  <label class="form-label">Comentario</label>
                  <textarea class="form-control" rows="4" formControlName="comment" maxlength="900"></textarea>
                  @if (form.controls.comment.touched && form.controls.comment.invalid) {
                    <div class="form-text text-danger">Entre 4 y 900 caracteres.</div>
                  }
                </div>

                <button class="btn btn-primary w-100" type="submit" [disabled]="form.invalid || submitting()">
                  @if (submitting()) {
                    <span class="spinner-border spinner-border-sm me-2"></span>
                  }
                  Enviar reseña
                </button>
              </form>
              <p class="small text-muted mt-3 mb-0">
                Máximo 5 envíos por minuto por IP. Tu mensaje será revisado antes de publicarse.
              </p>
            </div>
          </div>

          <div class="col-lg-7">
            @if (loading()) {
              <div class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando reseñas…</div>
            } @else if (listError()) {
              <div class="alert alert-warning">{{ listError() }}</div>
            } @else if (reviews().length === 0) {
              <div class="empty-reviews rounded-4 p-4">
                <p class="mb-0 text-muted">
                  Aún no hay reseñas aprobadas publicadas. Sé la primera persona en dejar tu experiencia usando el formulario.
                </p>
              </div>
            } @else {
              <div class="d-flex flex-column gap-3">
                @for (r of reviews(); track $index) {
                  <article class="review-card">
                    <div class="review-card-top">
                      <strong>{{ r.authorName }}</strong>
                      <span class="stars" aria-hidden="true">{{ starString(r.rating) }}</span>
                    </div>
                    <p class="review-comment mb-1">{{ r.comment }}</p>
                    @if (r.created_at) {
                      <span class="small text-muted">{{ r.created_at | date: 'mediumDate' }}</span>
                    }
                  </article>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .reviews-section {
      background: linear-gradient(180deg, rgba(248, 250, 252, 0.5) 0%, #ffffff 40%);
      border-top: 1px solid rgba(15, 23, 42, 0.06);
    }

    .eyebrow {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #2563eb;
      margin-bottom: 0.35rem;
    }

    .section-title {
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .section-lead {
      color: #64748b;
      max-width: 46rem;
    }

    .review-form-card {
      border-radius: 1.35rem;
      padding: 1.5rem;
      background: #fff;
      border: 1px solid rgba(148, 163, 184, 0.2);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    }

    .review-card {
      border-radius: 1.2rem;
      padding: 1.15rem 1.35rem;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .review-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.55rem;
    }

    .stars {
      letter-spacing: 0.06em;
      color: #d97706;
      font-weight: 700;
    }

    .review-comment {
      color: #334155;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .empty-reviews {
      background: rgba(241, 245, 249, 0.7);
      border: 1px dashed rgba(100, 116, 139, 0.35);
    }
  `,
})
export class PublicReviewsSectionComponent {
  private readonly api = inject(PublicReviewsApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly stars = [5, 4, 3, 2, 1];

  readonly reviews = signal<PublicReviewVm[]>([]);
  readonly loading = signal(true);
  readonly listError = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly submitOk = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    authorName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(900)]],
  });

  constructor() {
    this.api.list$(12).subscribe({
      next: (rows) => {
        this.reviews.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.listError.set('No pudimos cargar las reseñas en este momento.');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitOk.set(null);
    this.submitError.set(null);
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    this.api.create$({ ...raw, rating: Number(raw.rating) }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.submitOk.set(res.message ?? 'Gracias. Tu comentario fue recibido.');
        this.form.reset({ authorName: '', rating: 5, comment: '' });
      },
      error: (err) => {
        this.submitting.set(false);
        const msg =
          typeof err?.error?.message === 'string'
            ? err.error.message
            : 'No pudimos guardar tu reseña. Intenta más tarde o acorta el texto.';
        this.submitError.set(msg);
      },
    });
  }

  starLabel(n: number): string {
    if (n >= 5) return 'Excelente';
    if (n === 4) return 'Muy bueno';
    if (n === 3) return 'Bueno';
    if (n === 2) return 'Regular';
    return 'Por mejorar';
  }

  starString(n: number): string {
    return '★'.repeat(Math.min(5, Math.max(0, Math.round(n)))) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));
  }
}
