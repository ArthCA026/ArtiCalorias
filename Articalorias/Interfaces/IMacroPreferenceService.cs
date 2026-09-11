using Articalorias.DTOs.FoodParsing;
using Articalorias.DTOs.Macros;

namespace Articalorias.Interfaces;

public interface IMacroPreferenceService
{
    /// <summary>
    /// Every active catalog macro (protein included) with the user's stored
    /// settings merged over the catalog defaults, plus current auto-formula values.
    /// </summary>
    Task<IReadOnlyList<MacroPreferenceResponse>> GetForUserAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Upserts the submitted macros (missing macros keep their stored state)
    /// and returns the full merged list. The caller is expected to refresh
    /// today's day snapshot afterwards so the change applies from today only.
    /// </summary>
    Task<IReadOnlyList<MacroPreferenceResponse>> UpdateAsync(long userId, UpdateMacroPreferencesRequest request, CancellationToken ct = default);

    /// <summary>
    /// The optional macros the AI parser should extract for this user: the
    /// prompt only asks for what the user actually tracks, because extra
    /// fields make parsing slower, costlier and less accurate for everyone else.
    /// </summary>
    Task<FoodParsingOptions> GetParsingOptionsAsync(long userId, CancellationToken ct = default);
}
