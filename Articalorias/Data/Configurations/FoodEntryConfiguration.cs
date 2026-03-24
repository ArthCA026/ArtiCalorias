using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class FoodEntryConfiguration : IEntityTypeConfiguration<FoodEntry>
{
    public void Configure(EntityTypeBuilder<FoodEntry> builder)
    {
        builder.ToTable("FoodEntry", "app");
        builder.HasKey(f => f.FoodEntryId);

        builder.Property(f => f.FoodName).HasMaxLength(200).IsRequired();
        builder.Property(f => f.PortionDescription).HasMaxLength(150);
        builder.Property(f => f.Quantity).HasColumnType("decimal(10,3)");
        builder.Property(f => f.Unit).HasMaxLength(50);

        builder.Property(f => f.CaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.ProteinGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.FatGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.CarbsGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.AlcoholGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);

        builder.Property(f => f.SourceType).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(f => f.SortOrder).HasDefaultValue(0);
        builder.Property(f => f.Notes).HasMaxLength(500);

        builder.Property(f => f.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(f => f.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(f => f.RowVersion).IsRowVersion();

        builder.HasIndex(f => f.DailyLogId).HasDatabaseName("IX_FoodEntry_DailyLogId");

        builder.HasOne(f => f.DailyLog)
               .WithMany(d => d.FoodEntries)
               .HasForeignKey(f => f.DailyLogId)
               .HasConstraintName("FK_FoodEntry_DailyLog")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
