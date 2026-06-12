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
    }

    public async Task DeleteAccountAsync(long userId)
    {
        await _db.PushSubscriptions
            .Where(p => p.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.NotificationSchedules
            .Where(n => n.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.ActivityTemplates
            .Where(a => a.UserId == userId)
            .ExecuteDeleteAsync();

        // Clears DailyLogs (with cascade to FoodEntries + ActivityEntries) and MonthlySummaries.
        await ClearHistoryAsync(userId);

        await _db.UserProfiles
            .Where(p => p.UserId == userId)
            .ExecuteDeleteAsync();

        await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteDeleteAsync();
    }
}
