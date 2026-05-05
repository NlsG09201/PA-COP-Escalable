import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-simulation-ai',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="simulation-container">
      <div class="header d-flex justify-content-between align-items-center p-3 bg-white border-bottom shadow-sm">
        <h4 class="mb-0 fw-bold text-primary">
          <i class="bi bi-robot me-2"></i>Simulador de Ortodoncia IA Avanzado
        </h4>
        <div class="actions">
          <span class="badge bg-success me-2">Módulo IA Activo</span>
          <button class="btn btn-sm btn-outline-secondary" (click)="refresh()">
            <i class="bi bi-arrow-clockwise"></i> Recargar
          </button>
        </div>
      </div>
      
      <div class="iframe-wrapper">
        <iframe 
          *ngIf="safeUrl"
          [src]="safeUrl" 
          frameborder="0" 
          width="100%" 
          height="100%"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    </div>
  `,
  styles: [`
    .simulation-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
      background: #f8fafc;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .iframe-wrapper {
      flex: 1;
      position: relative;
    }
    iframe {
      border: none;
    }
    .header {
      z-index: 10;
    }
  `]
})
export class SimulationAiComponent implements OnInit {
  safeUrl: SafeResourceUrl | null = null;
  // En Docker, el servicio ortho-ai se expone en el puerto 8001
  private readonly baseUrl = 'http://localhost:8001/';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.baseUrl);
  }

  refresh(): void {
    const currentUrl = this.baseUrl;
    this.safeUrl = null;
    setTimeout(() => {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(currentUrl);
    }, 100);
  }
}
