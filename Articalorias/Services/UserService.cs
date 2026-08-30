using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;

    public UserService(AppDbContext db)
    {
        _db = db;
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

        // RefreshTokens and UserStreaks cascade off the user row itself.
        await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteDeleteAsync();

        await tx.CommitAsync();
    }
}
