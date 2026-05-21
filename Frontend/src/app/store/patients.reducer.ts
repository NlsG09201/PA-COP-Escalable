import { createReducer, on } from '@ngrx/store';
import { initialPatientsState } from './patients.state';
import {
  loadPatients,
  loadPatientsFailure,
  loadPatientsSuccess,
  selectPatient,
  syncPatientCatalog,
} from './patients.actions';
import { PatientVm } from '../features/patients/data-access/patients-api.service';

function upsertPatient(items: PatientVm[], patient: PatientVm): PatientVm[] {
  const idx = items.findIndex((p) => p.id === patient.id);
  if (idx < 0) return [...items, patient];
  return items.map((p, i) => (i === idx ? { ...p, ...patient } : p));
}

export const patientsReducer = createReducer(
  initialPatientsState,
  on(loadPatients, (state) => ({ ...state, loading: true })),
  on(loadPatientsSuccess, (state, { items }) => ({
    ...state,
    loading: false,
    items,
    selectedPatientId: state.selectedPatientId ?? items[0]?.id ?? null,
    selectedPatientSnapshot:
      state.selectedPatientSnapshot ??
      (state.selectedPatientId ? items.find((p) => p.id === state.selectedPatientId) ?? null : null),
  })),
  on(loadPatientsFailure, (state) => ({ ...state, loading: false })),
  on(syncPatientCatalog, (state, { items }) => {
    let nextItems = state.items;
    for (const p of items) {
      nextItems = upsertPatient(nextItems, p);
    }
    const selectedPatientSnapshot =
      state.selectedPatientId != null
        ? nextItems.find((p) => p.id === state.selectedPatientId) ?? state.selectedPatientSnapshot
        : state.selectedPatientSnapshot;
    return { ...state, items: nextItems, selectedPatientSnapshot };
  }),
  on(selectPatient, (state, { patientId, patient }) => {
    const snapshot =
      patient ?? state.items.find((p) => p.id === patientId) ?? state.selectedPatientSnapshot;
    const items = patient ? upsertPatient(state.items, patient) : state.items;
    return {
      ...state,
      selectedPatientId: patientId,
      selectedPatientSnapshot: snapshot && snapshot.id === patientId ? snapshot : snapshot,
      items,
    };
  }),
);
