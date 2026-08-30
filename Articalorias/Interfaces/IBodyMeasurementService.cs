using Articalorias.DTOs.Measurements;

namespace Articalorias.Interfaces;

public interface IBodyMeasurementService
{
    Task<IReadOnlyList<BodyMeasurementResponse>> GetAllAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Creates or updates the measurement for a local calendar day. When the
    /// day is (or becomes) the user's newest measurement, the profile's current
    /// weight / body fat follow it and today's day snapshot is refreshed.
    /// </summary>
    Task<BodyMeasurementResponse> UpsertAsync(long userId, DateOnly date, UpsertBodyMeasurementRequest request, DateOnly localToday, CancellationToken ct = default);

    /// <summary>
    /// Deletes a day's measurement. When the deleted row was the newest, the
    /// profile falls back to the next-newest measurement's values.
    /// </summary>
    Task<bool> DeleteAsync(long userId, DateOnly date, DateOnly localToday, CancellationToken ct = default);

    /// <summary>
    /// Deletes several days' measurements in one pass, syncing the profile to
    /// the surviving newest measurement once at the end. Returns the number of
    /// rows actually deleted.
    /// </summary>
    Task<int> DeleteBatchAsync(long userId, IReadOnlyList<DateOnly> dates, DateOnly localToday, CancellationToken ct = default);

    /// <summary>
    /// Records the profile's current weight/body-fat as today's measurement
    /// (source "profile"). Called by the profile save path so manual profile
    /// edits and the Body page can never disagree.
    /// </summary>
    Task RecordFromProfileAsync(long userId, CancellationToken ct = default);
}
