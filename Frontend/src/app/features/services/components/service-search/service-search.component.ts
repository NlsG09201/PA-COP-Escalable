import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-service-search',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-wrap">
      <input
        class="form-control"
        type="search"
        placeholder="Buscar por nombre o descripcion..."
        [value]="term"
        (input)="termChange.emit($any($event.target).value)" />
    </div>
  `
})
export class ServiceSearchComponent {
  @Input() term = '';
  @Output() readonly termChange = new EventEmitter<string>();
}
