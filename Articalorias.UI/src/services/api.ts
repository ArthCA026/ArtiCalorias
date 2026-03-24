import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored auth so the UI reacts through AuthProvider
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth');
      localStorage.removeItem('token');
      // Dispatch a storage event so AuthProvider picks it up in the same tab
      window.dispatchEvent(new Event('storage'));
    }
    return Promise.reject(error);
  },
);

export default api;
