import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ServiceQuery } from '../../models/service.model';

@Component({
  selector: 'app-service-filter',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-wrap">
      <div class="btn-group" role="group" aria-label="Filtro de categoria">
        <button class="btn btn-outline-secondary" [class.active]="category === 'ALL'" (click)="categoryChange.emit('ALL')">
          Todas
        </button>
        <button
          class="btn btn-outline-secondary"
          [class.active]="category === 'ODONTOLOGIA'"
          (click)="categoryChange.emit('ODONTOLOGIA')">
          Odontologia
        </button>
        <button
          class="btn btn-outline-secondary"
          [class.active]="category === 'PSICOLOGIA'"
          (click)="categoryChange.emit('PSICOLOGIA')">
          Psicologia
        </button>
      </div>

      <select class="form-select sort-select" [value]="sort" (change)="sortChange.emit($any($event.target).value)">
        <option value="name_asc">Ordenar por nombre</option>
        <option value="price_asc">Menor precio</option>
        <option value="price_desc">Mayor precio</option>
      </select>
    </div>
  `,
  styles: `
    .filter-wrap {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .sort-select {
      max-width: 240px;
    }
  `
})
export class ServiceFilterComponent {
  @Input({ required: true }) category!: ServiceQuery['category'];
  @Input({ required: true }) sort!: ServiceQuery['sort'];
  @Output() readonly categoryChange = new EventEmitter<ServiceQuery['category']>();
  @Output() readonly sortChange = new EventEmitter<ServiceQuery['sort']>();
}
