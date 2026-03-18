import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PatientsState } from './patients.state';

export const selectPatientsState = createFeatureSelector<PatientsState>('patients');

export const selectPatients = createSelector(selectPatientsState, (state) => state.items);
export const selectPatientsLoading = createSelector(selectPatientsState, (state) => state.loading);
export const selectSelectedPatientId = createSelector(selectPatientsState, (state) => state.selectedPatientId);
export const selectSelectedPatient = createSelector(
  selectPatients,
  selectSelectedPatientId,
  (patients, selectedPatientId) => patients.find((patient) => patient.id === selectedPatientId) ?? null
);
