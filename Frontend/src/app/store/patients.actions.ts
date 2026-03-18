import { createAction, props } from '@ngrx/store';
import { PatientVm } from '../features/patients/data-access/patients-api.service';

export const loadPatients = createAction('[Patients] Load');
export const loadPatientsSuccess = createAction('[Patients] Load Success', props<{ items: PatientVm[] }>());
export const loadPatientsFailure = createAction('[Patients] Load Failure');
export const selectPatient = createAction('[Patients] Select', props<{ patientId: string }>());
