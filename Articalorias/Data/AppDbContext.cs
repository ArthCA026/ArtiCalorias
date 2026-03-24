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
    public DbSet<ActivityTemplateSegment> ActivityTemplateSegments => Set<ActivityTemplateSegment>();
    public DbSet<ActivityEntry> ActivityEntries => Set<ActivityEntry>();
    public DbSet<ActivityEntrySegment> ActivityEntrySegments => Set<ActivityEntrySegment>();
    public DbSet<WeeklySummary> WeeklySummaries => Set<WeeklySummary>();
    public DbSet<MonthlySummary> MonthlySummaries => Set<MonthlySummary>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
