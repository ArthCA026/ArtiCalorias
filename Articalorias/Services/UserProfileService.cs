using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class UserProfileService : IUserProfileService
{
    private readonly AppDbContext _db;
    private readonly IRecalculationService _recalculation;

    public UserProfileService(AppDbContext db, IRecalculationService recalculation)
    {
        _db = db;
        _recalculation = recalculation;
    }

    public async Task<UserProfile?> GetByUserIdAsync(long userId)
    {
        return await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
    }

    public async Task<UserProfile> CreateOrUpdateAsync(long userId, UserProfile profile)
    {
        var existing = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (existing is null)
        {
            profile.UserId = userId;
            profile.IsOnboardingCompleted = true;
            ApplyAutoCalculations(profile);
            _db.UserProfiles.Add(profile);
        }
        else
        {
            var prevSleepMinutes = existing.DefaultSleepMinutes;
            var prevNeatMinutes = existing.DefaultNeatMinutes;

            existing.CurrentWeightKg = profile.CurrentWeightKg;
            existing.HeightCm = profile.HeightCm;
            existing.Age = profile.Age;
            existing.BiologicalSex = profile.BiologicalSex;
            existing.AutoCalculateBMR = profile.AutoCalculateBMR;
            existing.AutoCalculateBodyFat = profile.AutoCalculateBodyFat;
            existing.BMRKcal = profile.BMRKcal;
            existing.BodyFatPercent = profile.BodyFatPercent;
            existing.DailyBaseGoalKcal = profile.DailyBaseGoalKcal;
            existing.ProteinGoalGrams = profile.ProteinGoalGrams;
            existing.AutoCalculateProteinGoal = profile.AutoCalculateProteinGoal;
            existing.Country = profile.Country;
            existing.DefaultSleepMinutes = profile.DefaultSleepMinutes;
            existing.DefaultNeatMinutes = profile.DefaultNeatMinutes;
            existing.IsOnboardingCompleted = true;
            existing.UpdatedAtUtc = DateTime.UtcNow;
            ApplyAutoCalculations(existing);

            await _db.SaveChangesAsync();

            // Update today's global-default activity entries if durations changed
            var sleepChanged = existing.DefaultSleepMinutes != prevSleepMinutes;
            var neatChanged  = existing.DefaultNeatMinutes  != prevNeatMinutes;
            if (sleepChanged || neatChanged)
                await UpdateTodayDefaultActivitiesAsync(userId, existing, sleepChanged, neatChanged);

            return existing;
        }

        await _db.SaveChangesAsync();
        return existing ?? profile;
    }

    /// <summary>
    /// When the user changes their default Sleep or NEAT duration, update all
    /// daily logs from yesterday UTC onwards (today + any future logs the user
    /// already opened). The 1-day look-back handles users in any UTC-offset
    /// timezone whose local date may lag the server UTC date.
    /// Past logs (older than that) are never touched.
    /// </summary>
    private async Task UpdateTodayDefaultActivitiesAsync(
        long userId, UserProfile profile, bool updateSleep, bool updateNeat)
    {
        // Use yesterday UTC as the lower bound so users in UTC−X timezones
        // (whose local today = UTC yesterday) still have their log updated.
        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        var logs = await _db.DailyLogs
            .Include(d => d.ActivityEntries)
            .Where(d => d.UserId == userId && d.LogDate >= utcToday.AddDays(-1))
            .ToListAsync();

        if (logs.Count == 0) return;

        bool anyChanged = false;
        foreach (var log in logs)
        {
            foreach (var entry in log.ActivityEntries.Where(a => a.IsGlobalDefault))
            {
                if (updateSleep && entry.ActivityName == GlobalDefaultActivities.Sleep.Name)
                {
                    entry.DurationMinutes = profile.DefaultSleepMinutes;
                    var netMet = GlobalDefaultActivities.Sleep.METValue - 1m;
                    entry.CalculatedCaloriesKcal =
                        netMet * log.SnapshotWeightKg * (profile.DefaultSleepMinutes / 60m);
                    anyChanged = true;
                }
                else if (updateNeat && entry.ActivityName == GlobalDefaultActivities.DailyMovement.Name)
                {
                    entry.DurationMinutes = profile.DefaultNeatMinutes;
                    var netMet = GlobalDefaultActivities.DailyMovement.METValue - 1m;
                    entry.CalculatedCaloriesKcal =
                        netMet * log.SnapshotWeightKg * (profile.DefaultNeatMinutes / 60m);
                    anyChanged = true;
                }
            }
        }

        if (!anyChanged) return;

        await _db.SaveChangesAsync();

        // Clear the EF Core change tracker so RecalculateFullPipelineAsync
        // loads fresh entity instances from the database instead of relying on
        // the already-tracked (potentially stale) identity-map entries.
        _db.ChangeTracker.Clear();

        foreach (var log in logs)
            await _recalculation.RecalculateFullPipelineAsync(log.DailyLogId);
    }

    /// <summary>
    /// Applies Mifflin–St Jeor (BMR) and Deurenberg (Body Fat %) formulas
    /// when auto-calculate flags are enabled and the required inputs are present.
    /// </summary>
    private static void ApplyAutoCalculations(UserProfile p)
    {
        // BMR — Mifflin–St Jeor: Men  = 10W + 6.25H − 5A + 5
        //                        Women = 10W + 6.25H − 5A − 161
        if (p.AutoCalculateBMR && p.Age.HasValue && !string.IsNullOrEmpty(p.BiologicalSex))
        {
            var sexOffset = p.BiologicalSex == "M" ? 5m : -161m;
            p.BMRKcal = Math.Round(
                10m * p.CurrentWeightKg + 6.25m * p.HeightCm - 5m * p.Age.Value + sexOffset, 2);
        }

        // Body Fat % — Deurenberg: BF% = 1.20 × BMI + 0.23 × Age − 10.8 × Sex − 5.4
        //   Sex = 1 for men, 0 for women
        if (p.AutoCalculateBodyFat && p.Age.HasValue && !string.IsNullOrEmpty(p.BiologicalSex))
        {
            var heightM = p.HeightCm / 100m;
            var bmi = p.CurrentWeightKg / (heightM * heightM);
            var sexFactor = p.BiologicalSex == "M" ? 1m : 0m;
            p.BodyFatPercent = Math.Round(
                1.20m * bmi + 0.23m * p.Age.Value - 10.8m * sexFactor - 5.4m, 2);
        }
    }
}
