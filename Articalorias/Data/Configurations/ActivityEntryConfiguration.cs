using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class ActivityEntryConfiguration : IEntityTypeConfiguration<ActivityEntry>
{
    public void Configure(EntityTypeBuilder<ActivityEntry> builder)
    {
        builder.ToTable("ActivityEntry", "app");
        builder.HasKey(a => a.ActivityEntryId);

        builder.Property(a => a.ActivityType).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(a => a.ActivityName).HasMaxLength(150).IsRequired();

        builder.Property(a => a.DurationMinutes).HasColumnType("decimal(10,2)");
        builder.Property(a => a.DirectCaloriesKcal).HasColumnType("decimal(10,2)");
        builder.Property(a => a.METValue).HasColumnType("decimal(8,3)");

        builder.Property(a => a.CalculatedCaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(a => a.IsGlobalDefault).HasDefaultValue(false);
        builder.Property(a => a.Notes).HasMaxLength(500);
        builder.Property(a => a.SortOrder).HasDefaultValue(0);

        builder.Property(a => a.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(a => a.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(a => a.RowVersion).IsRowVersion();

        builder.HasIndex(a => a.DailyLogId).HasDatabaseName("IX_ActivityEntry_DailyLogId");

        builder.HasOne(a => a.DailyLog)
               .WithMany(d => d.ActivityEntries)
               .HasForeignKey(a => a.DailyLogId)
               .HasConstraintName("FK_ActivityEntry_DailyLog")
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.ActivityTemplate)
               .WithMany(t => t.ActivityEntries)
               .HasForeignKey(a => a.ActivityTemplateId)
               .HasConstraintName("FK_ActivityEntry_Template");
    }
}
