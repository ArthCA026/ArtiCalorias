using Articalorias.DTOs.Macros;

namespace Articalorias.Interfaces;

public interface IMacroPreferenceService
{
    /// <summary>
    /// All five optional macros with the user's stored settings merged over the
    /// defaults (not tracked, auto mode), plus current auto-formula values.
    /// </summary>
    Task<IReadOnlyList<MacroPreferenceResponse>> GetForUserAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Upserts the submitted macros (missing macros keep their stored state)
    /// and returns the full merged list. The caller is expected to refresh
    /// today's day snapshot afterwards so the change applies from today only.
    /// </summary>
    Task<IReadOnlyList<MacroPreferenceResponse>> UpdateAsync(long userId, UpdateMacroPreferencesRequest request, CancellationToken ct = default);
}
