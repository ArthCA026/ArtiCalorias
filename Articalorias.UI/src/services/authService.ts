import api from './api';
import type { LoginRequest, RegisterRequest, AuthResponse, ForgotPasswordRequest, ResetPasswordRequest } from '@/types';

export const authService = {
  login(data: LoginRequest) {
    return api.post<AuthResponse>('/auth/login', data);
  },

  register(data: RegisterRequest) {
    return api.post<AuthResponse>('/auth/register', data);
  },

  forgotPassword(data: ForgotPasswordRequest) {
    return api.post('/auth/forgot-password', data);
  },

  resetPassword(data: ResetPasswordRequest) {
    return api.post('/auth/reset-password', data);
  },
};
