import { PatientVm } from '../features/patients/data-access/patients-api.service';

export interface PatientsState {
  items: PatientVm[];
  loading: boolean;
  selectedPatientId: string | null;
}

export const initialPatientsState: PatientsState = {
  items: [],
  loading: false,
  selectedPatientId: null
};
