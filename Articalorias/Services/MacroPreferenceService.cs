using Articalorias.Data;
using Articalorias.DTOs.FoodParsing;
using Articalorias.DTOs.Macros;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Articalorias.Services.Macros;
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
            ValidateItem(item);

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
            // A stale custom value (or preset) is kept when switching modes or
            // turning the macro off, so the user's choice is still there if
            // they come back to it later.
            if (item.CustomTargetValue.HasValue)
                row.CustomTargetValue = item.CustomTargetValue;
            if (item.AutoParam.HasValue)
                row.AutoParam = item.AutoParam;
            row.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return Merge(profile, stored);
    }

    public async Task<FoodParsingOptions> GetParsingOptionsAsync(long userId, CancellationToken ct = default)
    {
        var stored = await _db.UserMacroPreferences
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .ToListAsync(ct);

        var tracked = MacroCatalog.Optional
            .Where(def => MacroTargetEngine.IsTracked(def, stored.FirstOrDefault(m => m.MacroKey == def.Key)))
            .Select(def => def.Key);

        return new FoodParsingOptions(tracked);
    }

    private static void ValidateItem(UpdateMacroPreferenceItem item)
    {
        if (!MacroCatalog.IsAcceptedInput(item.MacroKey))
            throw new ApiException(ErrorCodes.InvalidInput, $"Unknown macro '{item.MacroKey}'.");

        var def = MacroCatalog.ByKey[item.MacroKey];

        if (item.TargetMode == "custom" && item.IsTracked && item.CustomTargetValue is null or <= 0)
            throw new ApiException(ErrorCodes.InvalidInput, "A custom target needs a value greater than zero.");

        if (item.CustomTargetValue is { } custom
            && (custom < def.CustomTargetMin || custom > def.CustomTargetMax))
        {
            throw new ApiException(ErrorCodes.InvalidInput,
                $"The {def.Name.En} target must be between {def.CustomTargetMin:0.##} and {def.CustomTargetMax:0.##} {def.UnitCode}.");
        }

        if (item.AutoParam is { } param)
        {
            if (def.AutoParamRange is not { } range)
                throw new ApiException(ErrorCodes.InvalidInput, $"'{item.MacroKey}' has no adjustable auto parameter.");
            if (param < range.Min || param > range.Max)
                throw new ApiException(ErrorCodes.InvalidInput,
                    $"The {def.Name.En} parameter must be between {range.Min:0.##} and {range.Max:0.##}.");
        }
    }

    private static IReadOnlyList<MacroPreferenceResponse> Merge(UserProfile? profile, IReadOnlyList<UserMacroPreference> stored)
    {
        return MacroCatalog.Active
            .Select(def =>
            {
                var row = stored.FirstOrDefault(m => m.MacroKey == def.Key);
                var mode = row?.TargetMode ?? "auto";
                var auto = MacroTargetEngine.AutoTarget(def, profile, stored);
                return new MacroPreferenceResponse
                {
                    MacroKey = def.Key,
                    IsTracked = MacroTargetEngine.IsTracked(def, row),
                    TargetMode = mode,
                    CustomTargetValue = row?.CustomTargetValue,
                    AutoParam = def.AutoParamRange is null ? null : row?.AutoParam ?? def.DefaultAutoParam,
                    AutoTargetValue = auto,
                    EffectiveTarget = mode == "custom" ? row?.CustomTargetValue : auto,
                    Direction = def.DirectionCode,
                };
            })
            .ToList();
    }
}
