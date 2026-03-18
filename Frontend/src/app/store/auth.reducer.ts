import { createReducer, on } from '@ngrx/store';
import { setAuthRole } from './auth.actions';
import { initialAuthState } from './auth.state';

export const authReducer = createReducer(
  initialAuthState,
  on(setAuthRole, (state, { role }) => ({
    ...state,
    role,
    isAuthenticated: true
  }))
);
