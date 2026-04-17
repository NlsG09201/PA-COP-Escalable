import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  EmotionApiService,
  EmotionAnalysisResult,
  EmotionPrediction,
  ProsodyFeatures
} from '../../core/services/emotion-api.service';

const EMOTION_COLORS: Record<string, string> = {
  STRESS: '#ef4444',
  ANXIETY: '#f59e0b',
  SADNESS: '#3b82f6',
  ANGER: '#dc2626',
  CALM: '#10b981',
  NEUTRAL: '#6b7280',
  JOY: '#fbbf24'
};

function getEmotionColor(emotion: string | null | undefined): string {
  const key = (emotion ?? '').trim().toUpperCase();
  if (!key) return EMOTION_COLORS['NEUTRAL'] ?? '#6b7280';
  return EMOTION_COLORS[key] ?? '#6b7280';
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid">
      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle fs-5"></i>
          Selecciona un paciente para el análisis de voz emocional.
        </div>
      } @else {
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-mic text-primary"></i> Análisis de Voz Emocional
          </h4>
        </div>

        <div class="row g-4">
          <!-- Recorder section -->
          <div class="col-lg-6">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6 class="mb-3 d-flex align-items-center gap-2">
                  <i class="bi bi-soundwave text-primary"></i>
                  Grabadora de Audio
                </h6>

                <!-- Waveform canvas -->
                <div class="waveform-container bg-dark rounded-3 mb-3 position-relative overflow-hidden">
                  <canvas #waveformCanvas width="600" height="150" class="w-100"></canvas>
                  @if (recording()) {
                    <div class="position-absolute top-0 end-0 m-2">
                      <span class="badge bg-danger d-flex align-items-center gap-1">
                        <span class="rec-dot"></span> REC
                      </span>
                    </div>
                  }
                </div>

                <!-- Timer -->
                <div class="text-center mb-3">
                  <span class="fs-3 fw-bold font-monospace" [class.text-danger]="recording()">
                    {{ formatDuration(recordingDuration()) }}
                  </span>
                </div>

                <!-- Controls -->
                <div class="d-flex gap-2 justify-content-center mb-3">
                  @if (!recording()) {
                    <button class="btn btn-danger btn-lg rounded-pill px-4 d-flex align-items-center gap-2"
                            (click)="startRecording()" [disabled]="analyzing()">
                      <i class="bi bi-mic-fill"></i> Iniciar Grabación
                    </button>
                  } @else {
                    <button class="btn btn-outline-danger btn-lg rounded-pill px-4 d-flex align-items-center gap-2"
                            (click)="stopRecording()">
                      <i class="bi bi-stop-fill"></i> Detener y Analizar
                    </button>
                  }
                </div>

                <!-- Upload option -->
                <div class="text-center">
                  <div class="divider d-flex align-items-center gap-3 my-3">
                    <hr class="flex-grow-1"><span class="text-muted small">o</span><hr class="flex-grow-1">
                  </div>
                  <label class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">
                    <i class="bi bi-upload"></i> Subir archivo de audio
                    <input type="file" accept="audio/*" class="d-none" (change)="onFileSelected($event)">
                  </label>
                  @if (selectedFileName()) {
                    <div class="small text-muted mt-1">{{ selectedFileName() }}</div>
                  }
                </div>

                @if (analyzing()) {
                  <div class="text-center mt-3">
                    <div class="spinner-border text-primary"></div>
                    <p class="text-muted mt-2">Analizando audio...</p>
                  </div>
                }

                @if (error()) {
                  <div class="alert alert-danger mt-3 mb-0 py-2">
                    <i class="bi bi-exclamation-triangle me-1"></i>{{ error() }}
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Results section -->
          <div class="col-lg-6">
            @if (analysisResult()) {
              <!-- Primary emotion -->
              <div class="card border-0 shadow-sm mb-3">
                <div class="card-body text-center py-4">
                  <div class="primary-emotion-badge d-inline-flex align-items-center gap-2 px-4 py-3 rounded-pill mb-2"
                       [style.background]="getEmotionBg(analysisResult()?.primaryEmotion)"
                       [style.color]="getEmotionColor(analysisResult()?.primaryEmotion)">
                    <i class="bi bi-emoji-expressionless fs-3"></i>
                    <span class="fs-4 fw-bold">{{ analysisResult()?.primaryEmotion?.trim() || 'Sin clasificar' }}</span>
                  </div>
                  <p class="text-muted small mt-2 mb-0">Emoción Predominante</p>
                </div>
              </div>

              <!-- All emotions chart -->
              <div class="card border-0 shadow-sm mb-3">
                <div class="card-body">
                  <h6 class="mb-3">Todas las Emociones</h6>
                  @for (em of sortedEmotions(); track em.label) {
                    <div class="d-flex align-items-center gap-2 mb-2">
                      <div class="emotion-label small fw-semibold" style="min-width: 80px;">{{ em.label }}</div>
                      <div class="flex-grow-1">
                        <div class="progress" style="height: 20px;">
                          <div class="progress-bar" role="progressbar"
                               [style.width.%]="em.confidence * 100"
                               [style.background]="getEmotionColor(em.label)">
                          </div>
                        </div>
                      </div>
                      <div class="small fw-bold" style="min-width: 45px; text-align: right;">
                        {{ (em.confidence * 100) | number:'1.1-1' }}%
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Prosody features -->
              @if (analysisResult()!.prosody; as prosody) {
                <div class="card border-0 shadow-sm mb-3">
                  <div class="card-body">
                    <h6 class="mb-3 d-flex align-items-center gap-2">
                      <i class="bi bi-activity text-info"></i>
                      Características Prosódicas
                    </h6>
                    <div class="row g-3">
                      <div class="col-6">
                        <div class="prosody-item p-3 rounded bg-light">
                          <div class="small text-muted">Pitch (Media)</div>
                          <div class="fw-bold">{{ prosody.pitchMean | number:'1.1-1' }} Hz</div>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="prosody-item p-3 rounded bg-light">
                          <div class="small text-muted">Pitch (Variabilidad)</div>
                          <div class="fw-bold">{{ prosody.pitchStd | number:'1.1-1' }} Hz</div>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="prosody-item p-3 rounded bg-light">
                          <div class="small text-muted">Energía</div>
                          <div class="fw-bold">{{ prosody.energyMean | number:'1.2-2' }}</div>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="prosody-item p-3 rounded bg-light">
                          <div class="small text-muted">Vel. de Habla</div>
                          <div class="fw-bold">{{ prosody.speechRate | number:'1.1-1' }} sil/s</div>
                        </div>
                      </div>
                      <div class="col-12">
                        <div class="prosody-item p-3 rounded bg-light">
                          <div class="d-flex justify-content-between align-items-center">
                            <div>
                              <div class="small text-muted">Ratio de Pausas</div>
                              <div class="fw-bold">{{ (prosody.pauseRatio * 100) | number:'1.1-1' }}%</div>
                            </div>
                            <div class="progress flex-grow-1 ms-3" style="height: 8px; max-width: 200px;">
                              <div class="progress-bar bg-info" [style.width.%]="prosody.pauseRatio * 100"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            } @else if (!analyzing()) {
              <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-5">
                  <i class="bi bi-soundwave fs-1 text-muted d-block mb-3 opacity-25"></i>
                  <p class="text-muted">Graba o sube un audio para analizar las emociones del paciente.</p>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- History -->
        <div class="card border-0 shadow-sm mt-4">
          <div class="card-header bg-white border-bottom-0 pt-3">
            <h6 class="mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-clock-history text-secondary"></i>
              Historial de Análisis
            </h6>
          </div>
          <div class="card-body">
            @if (historyLoading()) {
              <div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>
            } @else if (history().length === 0) {
              <p class="text-muted text-center mb-0">Sin análisis previos</p>
            } @else {
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Emoción Principal</th>
                      <th>Duración</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of history(); track r.jobId) {
                      <tr class="cursor-pointer" (click)="viewResult(r)">
                        <td>{{ r.analyzedAt | date:'medium' }}</td>
                        <td>
                          <span class="badge rounded-pill px-3 py-1"
                                [style.background]="getEmotionBg(r.primaryEmotion)"
                                [style.color]="getEmotionColor(r.primaryEmotion)">
                            {{ r.primaryEmotion?.trim() || '—' }}
                          </span>
                        </td>
                        <td>{{ r.audioDurationSec | number:'1.1-1' }}s</td>
                        <td><span class="badge bg-success-subtle text-success">{{ r.status }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .waveform-container { height: 150px; background: #1a1a2e; }
    canvas { display: block; }
    .rec-dot {
      width: 8px; height: 8px; border-radius: 50%; background: currentColor;
      animation: blink 1s infinite;
    }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .primary-emotion-badge {
      font-size: 1.1rem; letter-spacing: 0.02em;
      border: 2px solid currentColor;
    }
    .prosody-item { transition: background 0.2s; }
    .prosody-item:hover { background: #e9ecef !important; }
    .cursor-pointer { cursor: pointer; }
    .progress { border-radius: 10px; }
    .progress-bar { border-radius: 10px; transition: width 0.6s ease; }
  `]
})
class VoiceAnalysisPageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly api = inject(EmotionApiService);

  @ViewChild('waveformCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly patientId = signal<string | null>(null);
  readonly recording = signal(false);
  readonly recordingDuration = signal(0);
  readonly analyzing = signal(false);
  readonly analysisResult = signal<EmotionAnalysisResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly selectedFileName = signal<string | null>(null);
  readonly history = signal<EmotionAnalysisResult[]>([]);
  readonly historyLoading = signal(false);

  readonly sortedEmotions = computed(() => {
    const result = this.analysisResult();
    if (!result?.allEmotions) return [];
    return [...result.allEmotions].sort((a, b) => b.confidence - a.confidence);
  });

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.store.select(selectSelectedPatientId).subscribe(id => {
      this.patientId.set(id ?? null);
      if (id) this.loadHistory(id);
    });
  }

  ngOnDestroy() {
    this.stopMediaStream();
    this.clearTimers();
  }

  async startRecording() {
    this.error.set(null);
    this.analysisResult.set(null);

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.error.set('No se pudo acceder al micrófono. Verifica los permisos.');
      return;
    }

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    source.connect(this.analyserNode);

    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
      this.analyzeFile(file);
    };

    this.mediaRecorder.start(250);
    this.recording.set(true);
    this.recordingDuration.set(0);

    this.durationInterval = setInterval(() => {
      this.recordingDuration.set(this.recordingDuration() + 1);
    }, 1000);

    this.drawWaveform();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.recording.set(false);
    this.stopMediaStream();
    this.clearTimers();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFileName.set(file.name);
    this.analyzeFile(file);
    input.value = '';
  }

  private analyzeFile(file: File) {
    const pid = this.patientId();
    if (!pid) return;

    this.analyzing.set(true);
    this.error.set(null);
    this.analysisResult.set(null);

    this.api.analyzeAudio$(pid, file).subscribe({
      next: result => {
        this.analysisResult.set(result);
        this.analyzing.set(false);
        this.loadHistory(pid);
      },
      error: (err) => {
        this.error.set('Error al analizar el audio. Intenta de nuevo.');
        this.analyzing.set(false);
      }
    });
  }

  viewResult(result: EmotionAnalysisResult) {
    this.analysisResult.set(result);
  }

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  getEmotionColor(emotion: string | null | undefined): string {
    return getEmotionColor(emotion);
  }

  getEmotionBg(emotion: string | null | undefined): string {
    const hex = getEmotionColor(emotion);
    return hex + '20';
  }

  private drawWaveform() {
    if (!this.analyserNode || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = this.analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.recording()) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }
      this.animationFrameId = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#667eea';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Frequency bars overlay
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      const barCount = 64;
      const barWidth = canvas.width / barCount;
      const step = Math.floor(bufferLength / barCount);

      ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
      for (let i = 0; i < barCount; i++) {
        const barHeight = (freqData[i * step] / 255) * canvas.height * 0.6;
        ctx.fillRect(
          i * barWidth,
          canvas.height - barHeight,
          barWidth - 1,
          barHeight
        );
      }
    };

    draw();
  }

  private stopMediaStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyserNode = null;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private clearTimers() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private loadHistory(patientId: string) {
    this.historyLoading.set(true);
    this.api.getResults$(patientId).subscribe({
      next: h => { this.history.set(h); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false)
    });
  }
}

export const VOICE_ANALYSIS_ROUTES: Routes = [{ path: '', component: VoiceAnalysisPageComponent }];
