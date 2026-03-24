using System.Security.Claims;
using Articalorias.DTOs.UserProfiles;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserProfileController : ControllerBase
{
    private readonly IUserProfileService _profileService;

    public UserProfileController(IUserProfileService profileService)
    {
        _profileService = profileService;
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
            Country = request.Country
        };

        var result = await _profileService.CreateOrUpdateAsync(userId, profile);
        return Ok(MapToResponse(result));
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
        Country = p.Country,
        IsOnboardingCompleted = p.IsOnboardingCompleted
    };
}
