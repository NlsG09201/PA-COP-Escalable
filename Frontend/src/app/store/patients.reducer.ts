import { createReducer, on } from '@ngrx/store';
import { initialPatientsState } from './patients.state';
import { loadPatients, loadPatientsFailure, loadPatientsSuccess, selectPatient } from './patients.actions';

export const patientsReducer = createReducer(
  initialPatientsState,
  on(loadPatients, (state) => ({ ...state, loading: true })),
  on(loadPatientsSuccess, (state, { items }) => ({
    ...state,
    loading: false,
    items,
    selectedPatientId: state.selectedPatientId ?? items[0]?.id ?? null
  })),
  on(loadPatientsFailure, (state) => ({ ...state, loading: false })),
  on(selectPatient, (state, { patientId }) => ({ ...state, selectedPatientId: patientId }))
);
