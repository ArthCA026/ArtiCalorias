# App Service settings the API expects

Settings live under **App Service → Configuration → Application settings**
(double underscore separates sections: `Jwt__SecretKey`). Changing one restarts
the app.

## Required

| Setting | Why |
|---|---|
| `Jwt__SecretKey` | At least 32 bytes of real secret. The API refuses to start on the committed placeholder or anything shorter (startup guard in `ServiceCollectionExtensions.AddJwtAuthentication`). |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` = `true` | Makes the framework trust the App Service front end's `X-Forwarded-For` / `X-Forwarded-Proto`. Without it every request carries the proxy's address, so the per-IP rate limits throttle all users as one and HSTS is never emitted (the app never sees HTTPS). |
| `Cors__AllowedOrigins__0` … | The SPA origins. The API refuses to start outside Development without at least one. |
| `ConnectionStrings__DefaultConnection`, `OpenAI__ApiKey`, `Smtp__*`, `Vapid__*`, `Onvo__*` | As before. |

## Optional switches added 2026-09-24

| Setting | Default | Effect |
|---|---|---|
| `OpenAI__Enabled` | `true` | `false` makes every AI endpoint answer 503 `AI_UNAVAILABLE` without calling OpenAI. Fastest way to stop spend. |
| `OpenAI__DailyCallCeiling` | `1000` | OpenAI calls per UTC day across all users; `0` disables the ceiling. |
| `Jwt__ExpirationMinutes` | `15` (was 60) | Access-token life. The app refreshes silently. |
| `Vapid__AllowedEndpointHostSuffixes__N` | FCM, Apple, Mozilla, Windows, Opera | Push-service hosts a subscription endpoint may point at. |

## Rate limits (code constants, `Configuration/RateLimitingExtensions.cs`)

| Bucket | Limit |
|---|---|
| Every request, per IP | 300 / minute (sliding) |
| `/api/auth/*`, per IP | 20 / minute |
| register, forgot-password, reset-password, per IP | 20 / 15 minutes |
| Failed logins, per account | 10 / 15 minutes (lockout) |
| forgot-password, per email | 60-s cooldown and 3 / hour |
| reset-password wrong codes, per email | 5 / 15 minutes, not reset by a new code |

All counters are in process memory: exact on a single instance, reset by a
restart. Move them to SQL or Redis before scaling out.

## Publish notes

- `web.config` at the project root is merged into the published site and
  strips `X-Powered-By` and the IIS `Server` header.
- Deleting history or the account and changing the password now require the
  current password in the request body; the UI was updated in the same change.
