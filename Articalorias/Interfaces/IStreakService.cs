using Articalorias.DTOs.Streaks;

namespace Articalorias.Interfaces;

public interface IStreakService
{
    /// <summary>
    /// Returns the user's current streak state, creating a default row if none exists.
    /// Applies a staleness check: if LastLoggedDate is more than one day before today
    /// (in the user's local timezone), CurrentStreak is reported as 0 without persisting.
    /// </summary>
    Task<StreakDto> GetOrCreateAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Recomputes CurrentStreak and LongestStreak from the user's food log history.
    /// Should be called after every food entry mutation (create, delete, date-change).
    /// No-op if the user's streak row has StreakEnabled = false.
    /// </summary>
    Task RecalculateForUserAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Enables or disables streak tracking. When enabling, triggers a full recalculation.
    /// </summary>
    Task<StreakDto> UpdateSettingsAsync(long userId, bool enabled, CancellationToken ct = default);

    /// <summary>
    /// Resets CurrentStreak to 0. LongestStreak and LastLoggedDate are not affected.
    /// </summary>
    Task<StreakDto> ResetAsync(long userId, CancellationToken ct = default);
}
