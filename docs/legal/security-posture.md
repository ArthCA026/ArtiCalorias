# Security posture (Art. 10) — measures and tracked open items

> DRAFT FOR LEGAL REVIEW. As of 2026-09-09.

## Measures in place

- HTTPS enforced outside development; JWT auth (60-min access tokens) with
  rotating one-time-use refresh tokens (SHA-256 hashed at rest, 30-day life).
- Passwords hashed with HMACSHA512 and a 32-byte per-user random salt.
- Every data endpoint requires authentication and scopes queries by the
  authenticated user id; consent middleware additionally blocks writes for
  users without a current health-data consent.
- Password reset: 6-digit code, 15-minute TTL, 5-attempt cap, resend
  cooldown, email-enumeration-safe responses.
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
| Password KDF is HMACSHA512, not memory-hard | `Services/AuthService.cs` | Offline cracking of a stolen DB is cheaper than with a modern KDF | Migrate to PBKDF2/Argon2id with rehash-on-login |
| JWT + refresh token kept in `localStorage` | `Articalorias.UI/src/services/api.ts`, `src/hooks/useAuth.tsx` | XSS can exfiltrate sessions | Consider httpOnly cookie for refresh token |
| Password reset code stored in plain text | `app.User.PasswordResetToken` | DB read exposes live codes (15-min TTL mitigates) | Store a hash of the code |
| Reset code appears in the email subject line | `Services/EmailService.cs` | Subjects are more exposed than bodies (previews, logs) | Move the code to the body only |
| No HSTS header in production | `Program.cs` | Downgrade attacks on first visit | Add `UseHsts()` outside Development |
| EF SQL parameter logging enabled in Development config | `appsettings.Development.json` | Dev logs contain health values and emails | Acceptable if dev-only; never promote to prod config |
| `Microsoft.OpenApi` 2.0.0 has a known high-severity advisory (NU1903) | `Articalorias.csproj` | Dependency vulnerability | Update the package |
| JWT embeds the user's email as a claim | `Services/AuthService.cs` | Tokens leak an identifier if intercepted/logged | Drop the email claim unless something consumes it |
| No email verification at sign-up | `AuthService.RegisterAsync` | Accounts can be created with someone else's address | Add verification if abuse appears |
