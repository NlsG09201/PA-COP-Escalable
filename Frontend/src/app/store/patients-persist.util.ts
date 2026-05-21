import { PatientVm } from '../features/patients/data-access/patients-api.service';

const ID_KEY = 'cop_selected_patient_id';
const SNAP_KEY = 'cop_selected_patient_snapshot';

export function readPersistedPatientSelection(): {
  selectedPatientId: string | null;
  selectedPatientSnapshot: PatientVm | null;
} {
  if (typeof localStorage === 'undefined') {
    return { selectedPatientId: null, selectedPatientSnapshot: null };
  }
  try {
    const selectedPatientId = localStorage.getItem(ID_KEY);
    const raw = localStorage.getItem(SNAP_KEY);
    const selectedPatientSnapshot = raw ? (JSON.parse(raw) as PatientVm) : null;
    return { selectedPatientId, selectedPatientSnapshot };
  } catch {
    return { selectedPatientId: null, selectedPatientSnapshot: null };
  }
}

export function persistPatientSelection(patientId: string, patient: PatientVm | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ID_KEY, patientId);
  if (patient) {
    localStorage.setItem(SNAP_KEY, JSON.stringify(patient));
  }
}
