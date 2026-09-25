# Security posture (Art. 10) — measures and tracked open items

> DRAFT FOR LEGAL REVIEW. As of 2026-09-24.

## Measures in place

- HTTPS enforced outside development (HSTS on the API host); JWT auth
  (15-min access tokens, HS256 pinned, 30-s clock skew) with rotating
  one-time-use refresh tokens (SHA-256 hashed at rest, 30-day life). A
  password reset or change revokes every refresh token of the account.
- Passwords hashed with PBKDF2-HMAC-SHA256 (600,000 iterations, 16-byte
  salt, self-describing format); rows still on the previous HMACSHA512
  format are rehashed transparently on their next successful login.
- Authorization is deny-by-default (fallback policy requires an
  authenticated user; anonymous actions are marked explicitly). Every
  single-record update/delete scopes the query by the authenticated user
  id, so a foreign id is indistinguishable from a missing one (404).
  Routine items and activity template references are checked for
  ownership before they are stored. Consent middleware additionally blocks
  writes for users without a current health-data consent.
- Abuse controls: per-IP request limits (global, auth, and a stricter
  register/reset bucket), per-account login lockout (10 failures / 15 min),
  per-email reset throttles, per-user AI quotas, a global daily OpenAI call
  ceiling and an `OpenAI:Enabled` kill switch. Failed logins are logged
  with the client address.
- Password reset: 6-digit code stored only as an HMAC (keyed by the server
  secret, bound to the user id), 15-minute TTL, 5-attempt cap that a new
  request does not reset, 60-s resend cooldown plus 3 requests/hour per
  address, identical responses whether or not the address exists (also when
  mail delivery fails). The code is in the email body, not the subject.
- Destructive account actions (clear history, delete account) and password
  changes require the current password on top of the session token.
- Push subscription endpoints must be HTTPS URLs on a known push-service
  host (server-side request forgery guard); batch sizes, date ranges and
  reminder schedules are bounded; uploaded images are checked against
  their declared type before leaving the server.
- API responses carry X-Content-Type-Options, X-Frame-Options, a
  no-op Content-Security-Policy, Referrer-Policy, Permissions-Policy and
  Cache-Control: no-store; IIS/ASP.NET banner headers are removed.
- Prompt-injection scanning on free text sent to the AI, with sanitized
  warning logs (`PromptInjectionScanner.SanitizeForLog`).
- Meal photos are never persisted; they transit to OpenAI and are discarded.
- Hardened 2026-09-09:
  - Application logs no longer record user free text or AI responses, only
    outcome and payload lengths (`FoodParsingService`, `ActivityParsingService`).
  - Scalar/OpenAPI reference is mapped only in Development (`Program.cs`).
  - CORS fails closed: outside Development the API refuses to start without
    an explicit `Cors:AllowedOrigins` list (`ServiceCollectionExtensions.cs`).

## Tracked open items (not yet addressed)

| Item | Where | Risk | Suggested fix |
|---|---|---|---|
| JWT + refresh token kept in `localStorage` | `Articalorias.UI/src/services/api.ts`, `src/hooks/useAuth.tsx` | XSS can exfiltrate sessions | Consider httpOnly cookie for refresh token |
| EF SQL parameter logging enabled in Development config | `appsettings.Development.json` | Dev logs contain health values and emails | Acceptable if dev-only; never promote to prod config |
| `Microsoft.OpenApi` 2.0.0 has a known high-severity advisory (NU1903) | `Articalorias.csproj` | Dependency vulnerability | Update the package |
| No email verification at sign-up | `AuthService.RegisterAsync` | Accounts can be created with someone else's address | Add verification if abuse appears |
| Rate limits and lockouts are in process memory | `Services/MemoryRateCounter.cs`, `Configuration/RateLimitingExtensions.cs` | Exact only on a single App Service instance; a restart resets counters | Move to SQL or Redis before scaling out |
| Client IP behind App Service needs the forwarded-headers switch | App Service configuration | Without `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` every request shares the proxy's address in the per-IP limits | Set the app setting (documented in `docs/ops/app-service-settings.md`) |
| Static site has no Content-Security-Policy yet | `Articalorias.UI/public/staticwebapp.config.json` | XSS could read the tokens kept in localStorage | Deferred: CSP + Permissions-Policy via SWA globalHeaders (see plan) |
