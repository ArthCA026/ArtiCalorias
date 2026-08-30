using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class UserProfileService : IUserProfileService
{
    private readonly AppDbContext _db;
    private readonly IBodyMeasurementService _measurements;

    public UserProfileService(AppDbContext db, IBodyMeasurementService measurements)
    {
        _db = db;
        _measurements = measurements;
    }

    public async Task<UserProfile?> GetByUserIdAsync(long userId)
    {
        return await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
    }

    public async Task<UserProfile> CreateOrUpdateAsync(long userId, UserProfile profile)
    {
        var existing = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        // Body-graph rule: a profile save only lands on the Body graph when the
        // body data itself moved. Every unrelated save (calorie display mode,
        // safeguard toggle, reminders, goal pace) also funnels through this
        // method, and recording those spammed the graph with one identical
        // "profile" point per day.
        var oldWeight = existing?.CurrentWeightKg;
        var oldBodyFat = existing?.BodyFatPercent;
        var oldAutoBodyFat = existing?.AutoCalculateBodyFat ?? true;

        NormalizeGoal(profile);

        if (existing is null)
        {
            profile.UserId = userId;
            profile.IsOnboardingCompleted = true;
            ValidateSleepNeatHours(profile.SleepHours, profile.NeatHours);
            ApplyAutoCalculations(profile);
            _db.UserProfiles.Add(profile);
        }
        else
        {
            existing.CurrentWeightKg = profile.CurrentWeightKg;
            existing.HeightCm = profile.HeightCm;
            existing.Age = profile.Age;
            existing.BiologicalSex = profile.BiologicalSex;
            existing.AutoCalculateBMR = profile.AutoCalculateBMR;
            existing.AutoCalculateBodyFat = profile.AutoCalculateBodyFat;
            existing.BMRKcal = profile.BMRKcal;
            existing.BodyFatPercent = profile.AutoCalculateBodyFat
                ? null   // let ApplyAutoCalculations compute a fresh, validated value
                : profile.BodyFatPercent;
            existing.DailyBaseGoalKcal = profile.DailyBaseGoalKcal;
            existing.ProteinGoalGrams = profile.ProteinGoalGrams;
            existing.AutoCalculateProteinGoal = profile.AutoCalculateProteinGoal;
            existing.ProteinGoalGramsPerKg = profile.ProteinGoalGramsPerKg;
            existing.GoalTargetWeightKg = profile.GoalTargetWeightKg;
            existing.GoalTargetBodyFatPercent = profile.GoalTargetBodyFatPercent;
            existing.GoalTargetDate = profile.GoalTargetDate;
            existing.Country = profile.Country;
            if (profile.TimeZoneId is not null)
            {
                // Validate IANA / Windows timezone ID before persisting
                existing.TimeZoneId = TimeZoneInfo.TryFindSystemTimeZoneById(profile.TimeZoneId, out _)
                    ? profile.TimeZoneId
                    : existing.TimeZoneId; // silently keep the previous valid value
            }
            existing.SleepHours = profile.SleepHours;
            existing.NeatHours = profile.NeatHours;
            existing.CalorieDisplayMode = profile.CalorieDisplayMode;
            existing.MinCaloriesSafeguardEnabled = profile.MinCaloriesSafeguardEnabled;
            existing.IsOnboardingCompleted = true;
            existing.UpdatedAtUtc = DateTime.UtcNow;
            ValidateSleepNeatHours(existing.SleepHours, existing.NeatHours);
            ApplyAutoCalculations(existing);

            await _db.SaveChangesAsync();

            if (BodyDataChanged(existing, oldWeight, oldBodyFat, oldAutoBodyFat))
                await _measurements.RecordFromProfileAsync(userId);

            return existing;
        }

        await _db.SaveChangesAsync();
        if (BodyDataChanged(profile, oldWeight, oldBodyFat, oldAutoBodyFat))
            await _measurements.RecordFromProfileAsync(userId);

        return existing ?? profile;
    }

    /// <summary>
    /// Whether this save changed what the Body graph records: the weight, or a
    /// MANUALLY entered body fat. Auto-calculated body fat is a formula output
    /// (it moves when age or height moves) and is never stored as if measured,
    /// so it cannot justify a new graph point on its own.
    /// </summary>
    private static bool BodyDataChanged(UserProfile saved, decimal? oldWeight, decimal? oldBodyFat, bool oldAutoBodyFat)
    {
        if (saved.CurrentWeightKg != oldWeight)
            return true;

        var manualBodyFatChanged = !saved.AutoCalculateBodyFat
            && (saved.BodyFatPercent != oldBodyFat || oldAutoBodyFat);
        return manualBodyFatChanged && saved.BodyFatPercent.HasValue;
    }

    /// <summary>
    /// Hard safety rails on the goal, whatever client sent it. The daily
    /// adjustment is clamped to the app-wide pace limits (−1.50 kg/week loss,
    /// +1.00 kg/week gain, at 7 700 kcal/kg). Target metadata is kept
    /// consistent: a target needs its date, only one target kind survives,
    /// and a plain pace goal carries no leftover target fields.
    /// </summary>
    private static void NormalizeGoal(UserProfile p)
    {
        p.DailyBaseGoalKcal = Math.Clamp(p.DailyBaseGoalKcal, -1650m, 1100m);

        if (p.GoalTargetDate is null)
        {
            p.GoalTargetWeightKg = null;
            p.GoalTargetBodyFatPercent = null;
        }
        else if (p.GoalTargetWeightKg is null && p.GoalTargetBodyFatPercent is null)
        {
            p.GoalTargetDate = null;
        }
        else if (p.GoalTargetWeightKg is not null)
        {
            // Weight target wins when a confused client sends both kinds.
            p.GoalTargetBodyFatPercent = null;
        }
    }

    private static void ValidateSleepNeatHours(decimal sleepHours, decimal neatHours)
    {
        if (sleepHours + neatHours > 23m)
            throw new InvalidOperationException(
                $"Sleep ({sleepHours}h) + NEAT ({neatHours}h) cannot exceed 23 hours per day. " +
                "At least 1 hour must remain for other activities.");
    }

    /// <summary>
    /// Applies Mifflin–St Jeor (BMR) and Deurenberg (Body Fat %) formulas
    /// when auto-calculate flags are enabled and the required inputs are present.
    /// Internal so the measurement sync path applies the exact same math.
    /// </summary>
    internal static void ApplyAutoCalculations(UserProfile p)
    {
        var hasBodyMetrics = p.CurrentWeightKg.HasValue && p.HeightCm.HasValue;

        // BMR — Mifflin–St Jeor: Men  = 10W + 6.25H − 5A + 5
        //                        Women = 10W + 6.25H − 5A − 161
        //                        Neutral (sex unknown) uses the average offset −78
        // Requires weight and height; skipped when either is null.
        if (p.AutoCalculateBMR && hasBodyMetrics)
        {
            var effectiveAge = p.Age ?? 30;
            var sexOffset = p.BiologicalSex == "M" ? 5m : p.BiologicalSex == "F" ? -161m : -78m;
            p.BMRKcal = Math.Round(
                10m * p.CurrentWeightKg!.Value + 6.25m * p.HeightCm!.Value - 5m * effectiveAge + sexOffset, 2);
        }

        // Body Fat % — Deurenberg: BF% = 1.20 × BMI + 0.23 × Age − 10.8 × Sex − 5.4
        //   Sex = 1 for men, 0 for women
        // The formula is only reliable for BMI 14–60; outside that range
        // (e.g. height entered as 17.3 cm instead of 173) it produces
        // unphysically large values that overflow decimal(5,2). Guard both
        // the BMI range and the final percentage before persisting.
        if (p.AutoCalculateBodyFat && hasBodyMetrics && p.Age.HasValue && !string.IsNullOrEmpty(p.BiologicalSex))
        {
            var heightM = p.HeightCm!.Value / 100m;
            if (heightM > 0m)
            {
                var bmi = p.CurrentWeightKg!.Value / (heightM * heightM);
                var sexFactor = p.BiologicalSex == "M" ? 1m : 0m;
                var bf = Math.Round(
                    1.20m * bmi + 0.23m * p.Age.Value - 10.8m * sexFactor - 5.4m, 2);
                // Only persist physically plausible body-fat percentages.
                p.BodyFatPercent = (bf >= 0m && bf <= 100m) ? bf : null;
            }
        }
    }
}
