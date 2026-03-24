import api from './api';
import type { LoginRequest, RegisterRequest, AuthResponse } from '@/types';

export const authService = {
  login(data: LoginRequest) {
    return api.post<AuthResponse>('/auth/login', data);
  },

  register(data: RegisterRequest) {
    return api.post<AuthResponse>('/auth/register', data);
  },
};
