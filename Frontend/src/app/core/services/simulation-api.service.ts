import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface ToothTransform {
  toothCode: string;
  translationX: number;
  translationY: number;
  translationZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  status: string;
  visible: boolean;
}

export interface SimulationPhase {
  phaseNumber: number;
  name: string;
  durationMonths: number;
  toothStates: Record<string, ToothTransform>;
  description: string;
}

export interface DentalSimulation {
  id: string;
  patientId: string;
  simulationType: string;
  initialState: Record<string, ToothTransform>;
  phases: SimulationPhase[];
  status: string;
  totalDurationMonths: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SimulationApiService {
  constructor(private readonly http: HttpClient) {}

  createSimulation$(patientId: string, type: string): Observable<DentalSimulation> {
    // Backend expects: POST /api/simulation/patients/{patientId}/create?type={ORTHODONTICS|IMPLANT|COMBINED}
    // and the type is sent as a query param (RequestParam), not in the JSON body.
    return this.http.post<DentalSimulation>(
      `${API_BASE_URL}/api/simulation/patients/${patientId}/create`,
      null,
      { params: { type } }
    );
  }

  simulateOrthodontics$(simulationId: string): Observable<DentalSimulation> {
    return this.http.post<DentalSimulation>(`${API_BASE_URL}/api/simulation/${simulationId}/orthodontics`, {});
  }

  simulateImplant$(simulationId: string, toothCodes: string[]): Observable<DentalSimulation> {
    return this.http.post<DentalSimulation>(`${API_BASE_URL}/api/simulation/${simulationId}/implant`, { toothCodes });
  }

  getSimulations$(patientId: string): Observable<DentalSimulation[]> {
    return this.http.get<DentalSimulation[]>(`${API_BASE_URL}/api/simulation/patients/${patientId}`);
  }

  getSimulation$(simulationId: string): Observable<DentalSimulation> {
    return this.http.get<DentalSimulation>(`${API_BASE_URL}/api/simulation/${simulationId}`);
  }
}
