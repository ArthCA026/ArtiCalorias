using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<DailyLog> DailyLogs => Set<DailyLog>();
    public DbSet<FoodEntry> FoodEntries => Set<FoodEntry>();
    public DbSet<ActivityTemplate> ActivityTemplates => Set<ActivityTemplate>();
    public DbSet<ActivityEntry> ActivityEntries => Set<ActivityEntry>();
    public DbSet<FoodTemplate> FoodTemplates => Set<FoodTemplate>();
    public DbSet<FavoriteRoutine> FavoriteRoutines => Set<FavoriteRoutine>();
    public DbSet<FavoriteRoutineItem> FavoriteRoutineItems => Set<FavoriteRoutineItem>();
    public DbSet<MonthlySummary> MonthlySummaries => Set<MonthlySummary>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<NotificationSchedule> NotificationSchedules => Set<NotificationSchedule>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserStreak> UserStreaks => Set<UserStreak>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
