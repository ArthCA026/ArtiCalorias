using System.Security.Claims;
using Articalorias.Data;
using Articalorias.DTOs.UserProfiles;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserProfileController : ControllerBase
{
    private readonly IUserProfileService _profileService;
    private readonly AppDbContext _db;

    public UserProfileController(IUserProfileService profileService, AppDbContext db)
    {
        _profileService = profileService;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetUserId();
        var profile = await _profileService.GetByUserIdAsync(userId);

        if (profile is null)
            return NotFound(new { Message = "Profile not found. Complete onboarding." });

        return Ok(MapToResponse(profile));
    }

    [HttpPut]
    public async Task<IActionResult> CreateOrUpdate([FromBody] UserProfileRequest request)
    {
        var userId = GetUserId();

        var profile = new UserProfile
        {
            CurrentWeightKg = request.CurrentWeightKg,
            HeightCm = request.HeightCm,
            Age = request.Age,
            BiologicalSex = request.BiologicalSex,
            BMRKcal = request.BMRKcal ?? 0m,
            BodyFatPercent = request.BodyFatPercent,
            AutoCalculateBMR = request.AutoCalculateBMR,
            AutoCalculateBodyFat = request.AutoCalculateBodyFat,
            DailyBaseGoalKcal = request.DailyBaseGoalKcal ?? -500m,
            ProteinGoalGrams = request.ProteinGoalGrams,
            AutoCalculateProteinGoal = request.AutoCalculateProteinGoal,
            ProteinGoalGramsPerKg = request.ProteinGoalGramsPerKg,
            GoalTargetWeightKg = request.GoalTargetWeightKg,
            GoalTargetBodyFatPercent = request.GoalTargetBodyFatPercent,
            GoalTargetDate = request.GoalTargetDate,
            Country = request.Country,
            TimeZoneId = request.TimeZoneId,
            SleepHours = request.SleepHours,
            NeatHours = request.NeatHours,
            CalorieDisplayMode = request.CalorieDisplayMode,
            MinCaloriesSafeguardEnabled = request.MinCaloriesSafeguardEnabled,
        };

        var result = await _profileService.CreateOrUpdateAsync(userId, profile);
        return Ok(MapToResponse(result));
    }

    /// <summary>
    /// Marks the first-run tutorial as completed or skipped. Idempotent, and a
    /// dedicated endpoint on purpose: the full profile PUT re-runs the
    /// auto-calculation pipeline, which a UI flag must never trigger.
    /// </summary>
    [HttpPost("tutorial-seen")]
    public async Task<IActionResult> TutorialSeen()
    {
        var userId = GetUserId();
        await _db.UserProfiles
            .Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.HasSeenTutorial, true));
        return NoContent();
    }

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }

    private static UserProfileResponse MapToResponse(UserProfile p) => new()
    {
        UserProfileId = p.UserProfileId,
        CurrentWeightKg = p.CurrentWeightKg,
        HeightCm = p.HeightCm,
        Age = p.Age,
        BiologicalSex = p.BiologicalSex,
        BMRKcal = p.BMRKcal,
        BodyFatPercent = p.BodyFatPercent,
        AutoCalculateBMR = p.AutoCalculateBMR,
        AutoCalculateBodyFat = p.AutoCalculateBodyFat,
        DailyBaseGoalKcal = p.DailyBaseGoalKcal,
        ProteinGoalGrams = p.ProteinGoalGrams,
        AutoCalculateProteinGoal = p.AutoCalculateProteinGoal,
        ProteinGoalGramsPerKg = p.ProteinGoalGramsPerKg,
        GoalTargetWeightKg = p.GoalTargetWeightKg,
        GoalTargetBodyFatPercent = p.GoalTargetBodyFatPercent,
        GoalTargetDate = p.GoalTargetDate,
        Country = p.Country,
        TimeZoneId = p.TimeZoneId,
        IsOnboardingCompleted = p.IsOnboardingCompleted,
        HasSeenTutorial = p.HasSeenTutorial,
        HasEverLoggedFood = p.FirstFoodLoggedAtUtc.HasValue,
        SleepHours = p.SleepHours,
        NeatHours = p.NeatHours,
        CalorieDisplayMode = p.CalorieDisplayMode,
        MinCaloriesSafeguardEnabled = p.MinCaloriesSafeguardEnabled,
    };
}
