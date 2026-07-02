import axios from 'axios';
import type { AuthResponse } from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate instance used only for token refresh — no interceptors to avoid loops.
const refreshClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Silent-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

function clearAuthAndNotify() {
  localStorage.removeItem('auth');
  localStorage.removeItem('token');
  window.dispatchEvent(new Event('storage'));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Read current refresh token from storage
    let authState: { refreshToken?: string; refreshTokenExpiresAtUtc?: string } | null = null;
    try {
      const raw = localStorage.getItem('auth');
      if (raw) authState = JSON.parse(raw);
    } catch {
      // ignore parse errors
    }

    if (
      !authState?.refreshToken ||
      !authState.refreshTokenExpiresAtUtc ||
      new Date(authState.refreshTokenExpiresAtUtc) <= new Date()
    ) {
      clearAuthAndNotify();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await refreshClient.post<AuthResponse>('/auth/refresh', {
        refreshToken: authState.refreshToken,
      });

      // Persist updated auth state
      const newState = {
        token: data.token,
        userId: data.userId,
        username: data.username,
        expiresAtUtc: data.expiresAtUtc,
        refreshToken: data.refreshToken,
        refreshTokenExpiresAtUtc: data.refreshTokenExpiresAtUtc,
      };
      localStorage.setItem('auth', JSON.stringify(newState));
      localStorage.setItem('token', data.token);

      // Notify AuthProvider in the same tab
      window.dispatchEvent(new Event('storage'));

      processQueue(null, data.token);
      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuthAndNotify();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
