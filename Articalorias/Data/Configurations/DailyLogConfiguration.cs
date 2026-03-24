using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class DailyLogConfiguration : IEntityTypeConfiguration<DailyLog>
{
    public void Configure(EntityTypeBuilder<DailyLog> builder)
    {
        builder.ToTable("DailyLog", "app");
        builder.HasKey(d => d.DailyLogId);

        // Snapshot
        builder.Property(d => d.SnapshotWeightKg).HasColumnType("decimal(8,2)");
        builder.Property(d => d.SnapshotHeightCm).HasColumnType("decimal(8,2)");
        builder.Property(d => d.SnapshotBMRKcal).HasColumnType("decimal(10,2)");
        builder.Property(d => d.SnapshotBodyFatPercent).HasColumnType("decimal(5,2)");
        builder.Property(d => d.SnapshotDailyBaseGoalKcal).HasColumnType("decimal(10,2)");
        builder.Property(d => d.SnapshotProteinGoalGrams).HasColumnType("decimal(10,2)");

        // Ingesta
        builder.Property(d => d.TotalFoodCaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.TotalProteinGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.TotalFatGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.TotalCarbsGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.TotalAlcoholGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);

        // Gasto
        builder.Property(d => d.TotalActivityCaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.TEFKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.HoursRemainingInDay).HasColumnType("decimal(6,2)").HasDefaultValue(0m);
        builder.Property(d => d.IdleTimeCaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.TotalDailyExpenditureKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);

        // Balance
        builder.Property(d => d.NetBalanceKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.DailyGoalDeltaKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.CaloriesRemainingToDailyTargetKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.ProteinRemainingGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);

        // Semanal
        builder.Property(d => d.WeeklyTargetKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.WeeklyActualToDateKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.WeeklyExpectedToDateKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.WeeklyDifferenceKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.WeeklyRemainingTargetKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(d => d.SuggestedDailyAverageRemainingKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);

        // Estado
        builder.Property(d => d.IsFinalized).HasDefaultValue(false);
        builder.Property(d => d.LastRecalculatedAtUtc).HasColumnType("datetime2(0)");
        builder.Property(d => d.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(d => d.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(d => d.RowVersion).IsRowVersion();

        // Índices
        builder.HasIndex(d => new { d.UserId, d.LogDate }).IsUnique().HasDatabaseName("UQ_DailyLog_User_LogDate");
        builder.HasIndex(d => new { d.UserId, d.WeekStartDate, d.LogDate }).HasDatabaseName("IX_DailyLog_User_WeekStartDate");
        builder.HasIndex(d => new { d.UserId, d.LogDate }).HasDatabaseName("IX_DailyLog_User_LogDate");

        // FK
        builder.HasOne(d => d.User)
               .WithMany(u => u.DailyLogs)
               .HasForeignKey(d => d.UserId)
               .HasConstraintName("FK_DailyLog_User");
    }
}
