import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { ECharts, EChartsOption, init } from 'echarts';
import { PsychologicalSnapshotVm } from '../../../core/services/psychology-api.service';

@Component({
  selector: 'app-psychology-evolution-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card shadow-sm border-0">
      <div class="card-header bg-white border-bottom-0 pt-3">
        <h6 class="card-title text-primary mb-0">Evolución Psicológica (IA-Assisted)</h6>
      </div>
      <div class="card-body">
        <div #chartContainer style="width: 100%; height: 400px;"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: 1.5rem; }
    .card { border-radius: 12px; }
  `]
})
export class PsychologyEvolutionChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @Input() set data(value: PsychologicalSnapshotVm[] | null) {
    if (value) {
      this.renderChart(value);
    }
  }

  private chart?: ECharts;

  ngOnInit() {
    this.chart = init(this.chartContainer.nativeElement);
    window.addEventListener('resize', () => this.chart?.resize());
  }

  ngOnDestroy() {
    this.chart?.dispose();
  }

  private renderChart(snapshots: PsychologicalSnapshotVm[]) {
    if (!this.chart || !snapshots.length) return;

    // Ordenar por fecha ascendente
    const sorted = [...snapshots].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    const dates = sorted.map(s => new Date(s.occurredAt).toLocaleDateString());
    const sentimentScores = sorted.map(s => s.sentimentScore);
    const wellbeing = sorted.map(s => s.metrics?.['wellbeing'] ?? null);
    const anxiety = sorted.map(s => s.metrics?.['anxiety'] ?? null);
    const stress = sorted.map(s => s.metrics?.['stress'] ?? null);

    const option: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let html = `<b>${params[0].axisValue}</b><br/>`;
          params.forEach((p: any) => {
            html += `${p.marker} ${p.seriesName}: ${p.value !== null ? p.value.toFixed(2) : 'N/A'}<br/>`;
          });
          const idx = params[0].dataIndex;
          if (sorted[idx].highRiskAlert) {
            html += `<span class="text-danger">⚠️ <b>Alerta de Riesgo:</b> ${sorted[idx].riskDetails}</span>`;
          }
          return html;
        }
      },
      legend: {
        data: ['Sentimiento', 'Bienestar', 'Ansiedad', 'Estrés'],
        bottom: 0
      },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: dates, boundaryGap: false },
      yAxis: { type: 'value', min: -1, max: 1 }, // El sentimiento va de -1 a 1, métricas de 0 a 1
      series: [
        {
          name: 'Sentimiento',
          type: 'line',
          smooth: true,
          data: sentimentScores,
          color: '#36A2EB',
          lineStyle: { width: 3 },
          markPoint: {
            data: sorted.map((s, idx) => s.highRiskAlert ? { coord: [idx, s.sentimentScore], value: '!', itemStyle: { color: '#dc3545' } } : null).filter(Boolean) as any
          }
        },
        { name: 'Bienestar', type: 'line', smooth: true, data: wellbeing, color: '#4BC0C0' },
        { name: 'Ansiedad', type: 'line', smooth: true, data: anxiety, color: '#FFCE56' },
        { name: 'Estrés', type: 'line', smooth: true, data: stress, color: '#FF6384' }
      ]
    };

    this.chart.setOption(option);
  }
}
