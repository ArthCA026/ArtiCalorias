export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  /** Versions of the documents accepted at sign-up (Ley 8968). The server
   * rejects registrations without all three at the current version. */
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  acceptedHealthDataVersion: string;
  /** UI language the documents were shown in ("es" | "en"). */
  consentLocale: string;
}

export interface AuthResponse {
  userId: number;
  username: string;
  token: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}
