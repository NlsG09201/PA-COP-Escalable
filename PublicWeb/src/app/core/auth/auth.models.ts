export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; roles: string[] };
}

export interface MeResponse {
  accessToken?: string;
  id: string;
  username: string;
  roles: string[];
  organization_id: string;
  site_id?: string;
  profile: null | {
    patientId: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    gender: 'M' | 'F' | 'O' | null;
  };
}

