import { UserRole } from '../core/models/user-role.model';

export interface AuthState {
  role: UserRole;
  isAuthenticated: boolean;
}

export const initialAuthState: AuthState = {
  role: 'ADMIN',
  isAuthenticated: true
};
