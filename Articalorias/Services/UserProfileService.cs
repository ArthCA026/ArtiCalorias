using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class UserProfileService : IUserProfileService
{
    private readonly AppDbContext _db;

    public UserProfileService(AppDbContext db)
    {
        _db = db;
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
            existing.IsOnboardingCompleted = true;
            existing.UpdatedAtUtc = DateTime.UtcNow;
            ApplyAutoCalculations(existing);
        }

        await _db.SaveChangesAsync();
        return existing ?? profile;
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
