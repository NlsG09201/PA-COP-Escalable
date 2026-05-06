import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, first, of, switchMap, timer } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export type Ortho3dJobVm = {
  jobId: string;
  status: string;
  externalJobId?: string;
  glbUrl?: string | null;
  externalResultUrl?: string | null;
  inputImageCount?: number;
  errorMessage?: string | null;
};

@Injectable({ providedIn: 'root' })
export class Ortho3dApiService {
  constructor(private readonly http: HttpClient) {}

  reconstruct$(patientId: string, files: File[] | File): Observable<Ortho3dJobVm> {
    const list = Array.isArray(files) ? files : [files];
    const body = new FormData();
    if (list.length === 1) {
      body.append('file', list[0]);
    } else {
      // Nest controller accepts both fields: `file` and `files`
      for (const f of list) body.append('files', f);
    }
    return this.http.post<Ortho3dJobVm>(
      `${API_BASE_URL}/api/ortho/3d/reconstruct?patientId=${encodeURIComponent(patientId)}`,
      body
    );
  }

  pollJob$(jobId: string): Observable<Ortho3dJobVm> {
    return this.http.get<Ortho3dJobVm>(
      `${API_BASE_URL}/api/ortho/3d/jobs/${encodeURIComponent(jobId)}`
    );
  }

  /** Poll until the provider finishes (async providers); noop if already terminal. */
  pollUntilDone$(jobId: string): Observable<Ortho3dJobVm> {
    return timer(0, 2500).pipe(
      switchMap(() => this.pollJob$(jobId)),
      first((j) => j.status === 'SUCCEEDED' || j.status === 'FAILED')
    );
  }

  /** Runs reconstruct then polls only when status is still processing. */
  reconstructAndResolve$(patientId: string, files: File[] | File): Observable<Ortho3dJobVm> {
    return this.reconstruct$(patientId, files).pipe(
      switchMap((res) => {
        if (res.status === 'SUCCEEDED' || res.status === 'FAILED') return of(res);
        return this.pollUntilDone$(res.jobId);
      })
    );
  }

  reconstructDicom$(patientId: string, zip: File): Observable<Ortho3dJobVm> {
    const body = new FormData();
    body.append('file', zip);
    return this.http.post<Ortho3dJobVm>(
      `${API_BASE_URL}/api/ortho/3d/reconstruct-dicom?patientId=${encodeURIComponent(patientId)}`,
      body
    );
  }

  reconstructDicomAndResolve$(patientId: string, zip: File): Observable<Ortho3dJobVm> {
    return this.reconstructDicom$(patientId, zip).pipe(
      switchMap((res) => {
        if (res.status === 'SUCCEEDED' || res.status === 'FAILED') return of(res);
        return this.pollUntilDone$(res.jobId);
      })
    );
  }
}
