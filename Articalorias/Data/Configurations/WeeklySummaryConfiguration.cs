using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class WeeklySummaryConfiguration : IEntityTypeConfiguration<WeeklySummary>
{
    public void Configure(EntityTypeBuilder<WeeklySummary> builder)
    {
        builder.ToTable("WeeklySummary", "app");
        builder.HasKey(w => w.WeeklySummaryId);

        builder.Property(w => w.BaseDailyGoalKcalUsed).HasColumnType("decimal(10,2)");
        builder.Property(w => w.ExpectedWeeklyTargetKcal).HasColumnType("decimal(10,2)");

        builder.Property(w => w.TotalFoodCaloriesKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.TotalProteinGrams).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.TotalFatGrams).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.TotalCarbsGrams).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.TotalAlcoholGrams).HasColumnType("decimal(12,2)").HasDefaultValue(0m);

        builder.Property(w => w.TotalActivityCaloriesKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.TotalTEFKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.TotalExpenditureKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);

        builder.Property(w => w.ActualWeeklyBalanceKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.DifferenceVsTargetKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.RemainingTargetKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(w => w.RequiredDailyAverageRemainingKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);

        builder.Property(w => w.DaysLogged).HasDefaultValue(0);
        builder.Property(w => w.EstimatedWeightChangeKg).HasColumnType("decimal(10,4)");

        builder.Property(w => w.LastCalculatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(w => w.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(w => w.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(w => w.RowVersion).IsRowVersion();

        builder.HasIndex(w => new { w.UserId, w.WeekStartDate })
               .IsUnique()
               .HasDatabaseName("UQ_WeeklySummary_User_Week");
        builder.HasIndex(w => new { w.UserId, w.WeekStartDate })
               .HasDatabaseName("IX_WeeklySummary_User_WeekStartDate");

        builder.HasOne(w => w.User)
               .WithMany(u => u.WeeklySummaries)
               .HasForeignKey(w => w.UserId)
               .HasConstraintName("FK_WeeklySummary_User");
    }
}
