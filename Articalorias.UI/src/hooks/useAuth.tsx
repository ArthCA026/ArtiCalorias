import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { AuthResponse } from "@/types";
import { authService } from "@/services/authService";

interface AuthState {
  token: string;
  userId: number;
  username: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
}

interface AuthContextValue {
  user: AuthState | null;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "auth";
const SESSION_EXPIRED_KEY = "session_expired";

function loadStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: AuthState = JSON.parse(raw);
    // Session is valid as long as the refresh token has not expired.
    // Expired access tokens are handled transparently by the axios interceptor.
    if (!parsed.refreshToken || new Date(parsed.refreshTokenExpiresAtUtc) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("token");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(loadStoredAuth);
  const [sessionExpired, setSessionExpired] = useState(
    () => sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1"
  );

  const markSessionExpired = useCallback(() => {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
    setSessionExpired(true);
  }, []);

  const login = useCallback((data: AuthResponse) => {
    const state: AuthState = {
      token: data.token,
      userId: data.userId,
      username: data.username,
      expiresAtUtc: data.expiresAtUtc,
      refreshToken: data.refreshToken,
      refreshTokenExpiresAtUtc: data.refreshTokenExpiresAtUtc,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem("token", data.token);
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    setSessionExpired(false);
    setUser(state);
  }, []);

  const logout = useCallback(() => {
    const stored = user;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("token");
    setUser(null);
    // Fire-and-forget: revoke the refresh token on the server.
    // We clear locally regardless of the outcome.
    if (stored?.refreshToken) {
      authService.revoke(stored.refreshToken).catch(() => undefined);
    }
  }, [user]);

  const clearSessionExpired = useCallback(() => {
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    setSessionExpired(false);
  }, []);

  // Listen for storage changes: cross-tab logouts and same-tab token refreshes
  // dispatched by the axios interceptor via window.dispatchEvent(new Event('storage')).
  useEffect(() => {
    const handler = () => {
      const loaded = loadStoredAuth();
      if (!loaded && user) {
        markSessionExpired();
      }
      setUser(loaded);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [user, markSessionExpired]);

  return (
    <AuthContext
      value={{
        user,
        isAuthenticated: user !== null,
        sessionExpired,
        login,
        logout,
        clearSessionExpired,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
