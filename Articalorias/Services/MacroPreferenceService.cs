using Articalorias.Data;
using Articalorias.DTOs.Macros;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class MacroPreferenceService : IMacroPreferenceService
{
    private readonly AppDbContext _db;

    public MacroPreferenceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<MacroPreferenceResponse>> GetForUserAsync(long userId, CancellationToken ct = default)
    {
        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        var stored = await _db.UserMacroPreferences
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .ToListAsync(ct);

        return Merge(profile, stored);
    }

    public async Task<IReadOnlyList<MacroPreferenceResponse>> UpdateAsync(long userId, UpdateMacroPreferencesRequest request, CancellationToken ct = default)
    {
        foreach (var item in request.Items)
        {
            if (!MacroTargets.IsValidKey(item.MacroKey))
                throw new ApiException(ErrorCodes.InvalidInput, $"Unknown macro '{item.MacroKey}'.");
            if (item.TargetMode == "custom" && item.IsTracked && item.CustomTargetValue is null or <= 0)
                throw new ApiException(ErrorCodes.InvalidInput, "A custom target needs a value greater than zero.");
        }

        var stored = await _db.UserMacroPreferences
            .Where(m => m.UserId == userId)
            .ToListAsync(ct);

        foreach (var item in request.Items)
        {
            var row = stored.FirstOrDefault(m => m.MacroKey == item.MacroKey);
            if (row is null)
            {
                row = new UserMacroPreference
                {
                    UserId = userId,
                    MacroKey = item.MacroKey,
                    CreatedAtUtc = DateTime.UtcNow,
                };
                _db.UserMacroPreferences.Add(row);
                stored.Add(row);
            }

            row.IsTracked = item.IsTracked;
            row.TargetMode = item.TargetMode;
            // A stale custom value is kept when switching back to auto so the
            // user's number is still there if they return to custom later.
            if (item.CustomTargetValue.HasValue)
                row.CustomTargetValue = item.CustomTargetValue;
            row.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return Merge(profile, stored);
    }

    private static IReadOnlyList<MacroPreferenceResponse> Merge(UserProfile? profile, IReadOnlyList<UserMacroPreference> stored)
    {
        return MacroTargets.OptionalMacroKeys
            .Select(key =>
            {
                var row = stored.FirstOrDefault(m => m.MacroKey == key);
                var auto = profile is null ? null : MacroTargets.AutoTargetFor(key, profile);
                var mode = row?.TargetMode ?? "auto";
                return new MacroPreferenceResponse
                {
                    MacroKey = key,
                    IsTracked = row?.IsTracked ?? false,
                    TargetMode = mode,
                    CustomTargetValue = row?.CustomTargetValue,
                    AutoTargetValue = auto,
                    EffectiveTarget = mode == "custom" ? row?.CustomTargetValue : auto,
                    Direction = MacroTargets.DirectionOf(key),
                };
            })
            .ToList();
    }
}
