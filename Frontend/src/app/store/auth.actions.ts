import { createAction, props } from '@ngrx/store';
import { UserRole } from '../core/models/user-role.model';

export const setAuthRole = createAction('[Auth] Set Role', props<{ role: UserRole }>());
