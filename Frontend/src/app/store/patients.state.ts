import { PatientVm } from '../features/patients/data-access/patients-api.service';
import { readPersistedPatientSelection } from './patients-persist.util';

export interface PatientsState {
  items: PatientVm[];
  loading: boolean;
  selectedPatientId: string | null;
  /** Nombre/datos del paciente activo aunque no esté en items (paginación). */
  selectedPatientSnapshot: PatientVm | null;
}

const persisted = readPersistedPatientSelection();

export const initialPatientsState: PatientsState = {
  items: [],
  loading: false,
  selectedPatientId: persisted.selectedPatientId,
  selectedPatientSnapshot: persisted.selectedPatientSnapshot,
};
