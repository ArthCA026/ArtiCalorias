using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class MonthlySummaryConfiguration : IEntityTypeConfiguration<MonthlySummary>
{
    public void Configure(EntityTypeBuilder<MonthlySummary> builder)
    {
        builder.ToTable("MonthlySummary", "app");
        builder.HasKey(m => m.MonthlySummaryId);

        builder.Property(m => m.TotalFoodCaloriesKcal).HasColumnType("decimal(14,2)").HasDefaultValue(0m);
        builder.Property(m => m.TotalProteinGrams).HasColumnType("decimal(14,2)").HasDefaultValue(0m);
        builder.Property(m => m.TotalFatGrams).HasColumnType("decimal(14,2)").HasDefaultValue(0m);
        builder.Property(m => m.TotalCarbsGrams).HasColumnType("decimal(14,2)").HasDefaultValue(0m);
        builder.Property(m => m.TotalAlcoholGrams).HasColumnType("decimal(14,2)").HasDefaultValue(0m);

        builder.Property(m => m.TotalActivityCaloriesKcal).HasColumnType("decimal(14,2)").HasDefaultValue(0m);
        builder.Property(m => m.TotalTEFKcal).HasColumnType("decimal(14,2)").HasDefaultValue(0m);
        builder.Property(m => m.TotalExpenditureKcal).HasColumnType("decimal(14,2)").HasDefaultValue(0m);

        builder.Property(m => m.ActualMonthlyBalanceKcal).HasColumnType("decimal(14,2)").HasDefaultValue(0m);

        builder.Property(m => m.AverageDailyFoodCaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(m => m.AverageDailyExpenditureKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(m => m.AverageDailyBalanceKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);

        builder.Property(m => m.AverageWeeklyBalanceKcal).HasColumnType("decimal(12,2)").HasDefaultValue(0m);
        builder.Property(m => m.EstimatedWeightChangeKg).HasColumnType("decimal(10,4)");
        builder.Property(m => m.DaysLogged).HasDefaultValue(0);

        builder.Property(m => m.LastCalculatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.RowVersion).IsRowVersion();

        builder.HasIndex(m => new { m.UserId, m.YearNumber, m.MonthNumber })
               .IsUnique()
               .HasDatabaseName("UQ_MonthlySummary_User_Year_Month");
        builder.HasIndex(m => new { m.UserId, m.YearNumber, m.MonthNumber })
               .HasDatabaseName("IX_MonthlySummary_User_Year_Month");

        builder.HasOne(m => m.User)
               .WithMany(u => u.MonthlySummaries)
               .HasForeignKey(m => m.UserId)
               .HasConstraintName("FK_MonthlySummary_User");
    }
}
