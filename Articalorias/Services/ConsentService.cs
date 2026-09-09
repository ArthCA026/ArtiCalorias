using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.DTOs.Consent;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Articalorias.Services;

public class ConsentService : IConsentService
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    private static readonly TimeSpan HealthGrantCacheTtl = TimeSpan.FromMinutes(5);

    public ConsentService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<ConsentStateResponse> GetStateAsync(long userId, CancellationToken ct = default)
    {
        var rows = await LoadRowsNewestFirstAsync(userId, ct);
        return BuildState(rows);
    }

    public async Task<ConsentStateResponse> RecordAsync(long userId, RecordConsentRequest request, CancellationToken ct = default)
    {
        if (request.Source is not (ConsentSources.Reconsent or ConsentSources.Profile))
            throw new ApiException(ErrorCodes.InvalidInput, "Unknown consent source.");

        var locale = ConsentLocales.Normalize(request.Locale);
        var existing = await LoadRowsNewestFirstAsync(userId, ct);

        foreach (var decision in request.Consents)
        {
            if (!ConsentTypes.All.Contains(decision.ConsentType))
                throw new ApiException(ErrorCodes.InvalidInput, "Unknown consent type.");

            string version;
            switch (decision.Action)
            {
                case ConsentActions.Granted:
                    var current = PolicyVersions.Current[decision.ConsentType];
                    if (decision.PolicyVersion != current)
                        throw new ApiException(ErrorCodes.ConsentVersionStale,
                            "The accepted document version is no longer current. Please reload and review the updated text.");
                    version = current;
                    break;

                case ConsentActions.Revoked:
                    // Record the version the user actually held, not whatever
                    // the client sent - the audit row is evidence.
                    version = existing.FirstOrDefault(r =>
                                  r.ConsentType == decision.ConsentType &&
                                  r.Action == ConsentActions.Granted)?.PolicyVersion
                              ?? PolicyVersions.Current[decision.ConsentType];
                    break;

                default:
                    throw new ApiException(ErrorCodes.InvalidInput, "Unknown consent action.");
            }

            _db.UserConsents.Add(new UserConsent
            {
                UserId = userId,
                ConsentType = decision.ConsentType,
                PolicyVersion = version,
                Action = decision.Action,
                Locale = locale,
                Source = request.Source
            });
        }

        await _db.SaveChangesAsync(ct);
        _cache.Remove(HealthGrantCacheKey(userId));

        return await GetStateAsync(userId, ct);
    }

    public async Task<bool> HasCurrentHealthGrantAsync(long userId, CancellationToken ct = default)
    {
        var key = HealthGrantCacheKey(userId);
        if (_cache.TryGetValue(key, out bool cached))
            return cached;

        var latest = await _db.UserConsents
            .Where(c => c.UserId == userId && c.ConsentType == ConsentTypes.HealthData)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ThenByDescending(c => c.UserConsentId)
            .FirstOrDefaultAsync(ct);

        var hasGrant = latest is { Action: ConsentActions.Granted } &&
                       latest.PolicyVersion == PolicyVersions.HealthData;

        _cache.Set(key, hasGrant, HealthGrantCacheTtl);
        return hasGrant;
    }

    private async Task<List<UserConsent>> LoadRowsNewestFirstAsync(long userId, CancellationToken ct)
    {
        // CreatedAtUtc is second precision; the identity tie-breaks rows
        // written in the same batch (register/reconsent write three at once).
        return await _db.UserConsents
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ThenByDescending(c => c.UserConsentId)
            .ToListAsync(ct);
    }

    private static ConsentStateResponse BuildState(List<UserConsent> rowsNewestFirst)
    {
        var response = new ConsentStateResponse
        {
            History = rowsNewestFirst.Select(r => new ConsentHistoryItem
            {
                ConsentType = r.ConsentType,
                PolicyVersion = r.PolicyVersion,
                Action = r.Action,
                Locale = r.Locale,
                Source = r.Source,
                CreatedAtUtc = r.CreatedAtUtc
            }).ToList()
        };

        foreach (var type in ConsentTypes.All)
        {
            var latest = rowsNewestFirst.FirstOrDefault(r => r.ConsentType == type);
            var isCurrent = latest is { Action: ConsentActions.Granted } &&
                            latest.PolicyVersion == PolicyVersions.Current[type];

            response.Consents.Add(new ConsentStateItem
            {
                ConsentType = type,
                Status = latest?.Action ?? "none",
                PolicyVersion = latest?.PolicyVersion,
                RecordedAtUtc = latest?.CreatedAtUtc,
                IsCurrent = isCurrent
            });

            if (!isCurrent)
                response.RequiresConsent.Add(type);
        }

        return response;
    }

    private static string HealthGrantCacheKey(long userId) => $"consent-health-grant:{userId}";
}
