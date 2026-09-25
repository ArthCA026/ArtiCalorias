using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;
    private readonly IBillingService _billing;

    public UserService(AppDbContext db, IBillingService billing)
    {
        _db = db;
        _billing = billing;
    }

    public async Task<User?> GetByIdAsync(long userId)
    {
        return await _db.Users.FindAsync(userId);
    }

    public async Task<User?> GetByUsernameAsync(string username)
    {
        return await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
    }

    public async Task ClearHistoryAsync(long userId)
    {
        // FoodEntry and ActivityEntry cascade when their DailyLog is deleted.
        await _db.DailyLogs
            .Where(d => d.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.MonthlySummaries
            .Where(m => m.UserId == userId)
            .ExecuteDeleteAsync();

        // Body measurements are logged history too. Macro preferences are NOT:
        // like templates and reminders, they are settings and survive a reset.
        await _db.BodyMeasurements
            .Where(m => m.UserId == userId)
            .ExecuteDeleteAsync();

        // The user themself never logged anything anymore: the first-log flag
        // must reset with the history or the getting-started flow stays hidden.
        await _db.UserProfiles
            .Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.FirstFoodLoggedAtUtc, (DateTime?)null));
    }

    public async Task DeleteAccountAsync(long userId)
    {
        // Billing first, and OUTSIDE the transaction (it is an HTTP call to
        // ONVO, not a row). If the subscription cannot be confirmed cancelled
        // this throws and nothing is deleted: an erased account whose card
        // keeps being charged is the one outcome that must never happen.
        await _billing.CancelAllForAccountDeletionAsync(userId);

        // One transaction: account deletion is all-or-nothing. Each
        // ExecuteDelete otherwise commits on its own, and a failure halfway
        // used to leave a half-deleted account - reminders and templates
        // gone, login still working.
        await using var tx = await _db.Database.BeginTransactionAsync();

        await _db.PushSubscriptions
            .Where(p => p.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.NotificationSchedules
            .Where(n => n.UserId == userId)
            .ExecuteDeleteAsync();

        // Routines before templates (their items reference both template
        // kinds; the items themselves cascade off the routine). FoodTemplate
        // and FavoriteRoutine have NO cascade from User, so forgetting either
        // makes the final user delete throw an FK conflict.
        await _db.FavoriteRoutines
            .Where(r => r.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.FoodTemplates
            .Where(f => f.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.ActivityTemplates
            .Where(a => a.UserId == userId)
            .ExecuteDeleteAsync();

        // Clears DailyLogs (with cascade to FoodEntries + ActivityEntries),
        // MonthlySummaries and BodyMeasurements.
        await ClearHistoryAsync(userId);

        await _db.UserMacroPreferences
            .Where(m => m.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.UserProfiles
            .Where(p => p.UserId == userId)
            .ExecuteDeleteAsync();

        // Local billing mirror and audit trail. The transaction records
        // themselves stay with ONVO, the payment processor.
        await _db.BillingEvents
            .Where(e => e.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.UserSubscriptions
            .Where(s => s.UserId == userId)
            .ExecuteDeleteAsync();

        // RefreshTokens and UserStreaks cascade off the user row itself.
        await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteDeleteAsync();

        await tx.CommitAsync();
    }

    public async Task<object?> ExportAsync(long userId)
    {
        // Credentials are excluded by projection, never by post-filtering.
        var account = await _db.Users.AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new { u.UserId, u.Username, u.Email, u.IsActive, u.CreatedAtUtc, u.LastActiveAtUtc })
            .FirstOrDefaultAsync();

        if (account is null)
            return null;

        // Flat AsNoTracking queries on purpose: no Includes means no nav
        // fixup, so the entity graphs stay acyclic and serialize cleanly.
        var profile = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);

        var dailyLogs = await _db.DailyLogs.AsNoTracking()
            .Where(d => d.UserId == userId).OrderBy(d => d.LogDate).ToListAsync();

        var foodEntries = await _db.FoodEntries.AsNoTracking()
            .Where(f => f.DailyLog.UserId == userId).ToListAsync();

        var activityEntries = await _db.ActivityEntries.AsNoTracking()
            .Where(a => a.DailyLog.UserId == userId).ToListAsync();

        var bodyMeasurements = await _db.BodyMeasurements.AsNoTracking()
            .Where(m => m.UserId == userId).OrderBy(m => m.MeasuredOn).ToListAsync();

        var monthlySummaries = await _db.MonthlySummaries.AsNoTracking()
            .Where(m => m.UserId == userId).ToListAsync();

        var foodTemplates = await _db.FoodTemplates.AsNoTracking()
            .Where(f => f.UserId == userId).ToListAsync();

        var activityTemplates = await _db.ActivityTemplates.AsNoTracking()
            .Where(a => a.UserId == userId).ToListAsync();

        var favoriteRoutines = await _db.FavoriteRoutines.AsNoTracking()
            .Where(r => r.UserId == userId).ToListAsync();

        var routineIds = favoriteRoutines.Select(r => r.FavoriteRoutineId).ToList();
        var favoriteRoutineItems = await _db.FavoriteRoutineItems.AsNoTracking()
            .Where(i => routineIds.Contains(i.FavoriteRoutineId)).ToListAsync();

        var macroPreferences = await _db.UserMacroPreferences.AsNoTracking()
            .Where(m => m.UserId == userId).ToListAsync();

        var streak = await _db.UserStreaks.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);

        var notificationSchedules = await _db.NotificationSchedules.AsNoTracking()
            .Where(n => n.UserId == userId).ToListAsync();

        // A push subscription is a capability (endpoint URL + encryption keys),
        // not personal data worth handing back: the export names the device's
        // push service and when it was registered, nothing usable to send.
        var pushSubscriptions = (await _db.PushSubscriptions.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => new { p.Endpoint, p.CreatedAtUtc })
            .ToListAsync())
            .Select(p => new
            {
                PushService = Uri.TryCreate(p.Endpoint, UriKind.Absolute, out var uri) ? uri.Host : "unknown",
                p.CreatedAtUtc
            })
            .ToList();

        var consents = await _db.UserConsents.AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.CreatedAtUtc)
            .Select(c => new { c.ConsentType, c.PolicyVersion, c.Action, c.Locale, c.Source, c.CreatedAtUtc })
            .ToListAsync();

        // Billing: what we hold is the plan, its dates and the ONVO references.
        // Card details never reach this system, so there are none to export.
        var subscriptions = await _db.UserSubscriptions.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.CreatedAtUtc)
            .Select(s => new
            {
                s.PlanCode, s.PriceCents, s.Currency, s.Status, s.CancelAtPeriodEnd,
                s.PaidThroughUtc, s.CanceledAtUtc, s.CreatedAtUtc,
                s.OnvoMode, s.OnvoCustomerId, s.OnvoSubscriptionId
            })
            .ToListAsync();

        var billingEvents = await _db.BillingEvents.AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderBy(e => e.CreatedAtUtc)
            .Select(e => new { e.EventType, e.Detail, e.CreatedAtUtc })
            .ToListAsync();

        return new
        {
            ExportedAtUtc = DateTime.UtcNow,
            Account = account,
            Profile = profile,
            DailyLogs = dailyLogs,
            FoodEntries = foodEntries,
            ActivityEntries = activityEntries,
            BodyMeasurements = bodyMeasurements,
            MonthlySummaries = monthlySummaries,
            FoodTemplates = foodTemplates,
            ActivityTemplates = activityTemplates,
            FavoriteRoutines = favoriteRoutines,
            FavoriteRoutineItems = favoriteRoutineItems,
            MacroPreferences = macroPreferences,
            Streak = streak,
            NotificationSchedules = notificationSchedules,
            PushSubscriptions = pushSubscriptions,
            Consents = consents,
            Subscriptions = subscriptions,
            BillingEvents = billingEvents
        };
    }
}
