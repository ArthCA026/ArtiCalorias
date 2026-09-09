# Data inventory (Ley 8968)

> DRAFT FOR LEGAL REVIEW. Snapshot of the production schema as of 2026-09-09.
> Sources: `Articalorias.UI/Database/DatabaseCreationScript.sql` plus the
> migrations in `Articalorias/Database/Migrations/` and the EF entities in
> `Articalorias/Models/Entities/`.

Classification legend: **P** personal data, **S** sensitive (health) data,
**B** behavioral/usage data, **T** technical data.

## `app.User` — identity

| Column | Class | Notes |
|---|---|---|
| Username, Email | P | Direct identifiers, unique. Email also inside the JWT claims. |
| PasswordHash, PasswordSalt | T | HMACSHA512 + per-user salt. Never exported. |
| PasswordResetToken (+ expiry) | T | 6-digit code, 15-min TTL. Stored in plain text (see security-posture.md). |
| LastActiveAtUtc | B | App-open heartbeat. |

## `app.UserProfile` — core health profile

| Column | Class |
|---|---|
| CurrentWeightKg, HeightCm, Age, BiologicalSex | S |
| BMRKcal, BodyFatPercent (+ auto-calc flags) | S |
| DailyBaseGoalKcal, ProteinGoalGrams, ProteinGoalGramsPerKg | S |
| GoalTargetWeightKg, GoalTargetBodyFatPercent, GoalTargetDate | S |
| SleepHours, NeatHours | S |
| MinCaloriesSafeguardEnabled | S (eating-disorder guardrail flag) |
| Country | P (also sent to OpenAI in the AI prompt) |
| TimeZoneId | T/P (auto-stamped from the device on every save) |
| IsOnboardingCompleted, HasSeenTutorial, FirstFoodLoggedAtUtc | B |

## `app.BodyMeasurement` — longitudinal body data

WeightKg, BodyFatPercent per local calendar day (**S**). Note: migration
`20260814_body-measurements.sql` retroactively derived historical weight
points from existing DailyLog snapshots (Source = 'history').

## `app.DailyLog` — daily health snapshot

One row per user per day (**S** throughout): snapshot weight/height/BMR/body
fat/goals/sleep/NEAT; intake totals including **TotalAlcoholGrams**, sugar,
water; expenditure and balance columns; **IsFastingDay** (deliberate fasting
behavior). FoodEntry and ActivityEntry cascade from it.

## `app.FoodEntry` — dietary log

FoodName, PortionDescription, quantities, full macro profile including
alcohol (**S**), and **Notes** (free text, may contain anything the user
types, treated as sensitive by default).

## `app.ActivityEntry` / `app.ActivityTemplate` — exercise

ActivityName, DurationMinutes, METValue, CalculatedCaloriesKcal (**S**).

## `app.FoodTemplate`, `app.FavoriteRoutine(Item)` — habitual diet

Named meals/routines with macro profiles (**S**, reveals dietary habits).

## `app.MonthlySummary` — aggregates

Monthly balances and EstimatedWeightChangeKg (**S**).

## `app.UserMacroPreference`, `app.UserStreaks` — settings/behavior

Tracked macros and targets (**S**-adjacent); streak counters (**B**).

## `dbo.PushSubscriptions`, `dbo.NotificationSchedules`

Push endpoint + encryption keys (**T**, device identifier pointing at
Google/Mozilla/Apple push infrastructure); meal reminder times (**B**,
combined with TimeZoneId reveals daily routine).

## `app.RefreshTokens`

SHA-256 hashes of session refresh tokens (**T**), 30-day lifetime.

## `app.UserConsent` — consent audit (added 2026-09-09)

Append-only: ConsentType, PolicyVersion, Action, Locale, Source,
CreatedAtUtc. Evidence of Art. 5/9 consent; cascade-deletes with the account
(see open question Q5).

## Not stored

- Meal photos: transit only (browser → API → OpenAI), never written to DB or disk.
- Real name, phone, national ID, birthdate: never collected (age is a bare number).
- Payment data: none (premium UI is a disabled mock, no billing integration).
- Analytics/advertising identifiers: none (no third-party analytics SDKs).
