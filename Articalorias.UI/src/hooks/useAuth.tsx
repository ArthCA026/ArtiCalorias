import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { AuthResponse } from "@/types";

interface AuthState {
  token: string;
  userId: number;
  username: string;
  expiresAtUtc: string;
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
    if (new Date(parsed.expiresAtUtc) <= new Date()) {
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem("token", data.token);
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    setSessionExpired(false);
    setUser(state);
  }, []);

  const logout = useCallback(() => {
    clearTimer();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("token");
    setUser(null);
  }, [clearTimer]);

  const clearSessionExpired = useCallback(() => {
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    setSessionExpired(false);
  }, []);

  // Proactive expiry timer: auto-logout when the token expires
  useEffect(() => {
    clearTimer();
    if (!user) return;

    const msUntilExpiry = new Date(user.expiresAtUtc).getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      markSessionExpired();
      logout();
      return;
    }

    timerRef.current = setTimeout(() => {
      markSessionExpired();
      logout();
    }, msUntilExpiry);

    return clearTimer;
  }, [user, clearTimer, logout, markSessionExpired]);

  // Listen for storage changes in other tabs + 401 same-tab dispatch
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
