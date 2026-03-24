using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class ActivityEntrySegmentConfiguration : IEntityTypeConfiguration<ActivityEntrySegment>
{
    public void Configure(EntityTypeBuilder<ActivityEntrySegment> builder)
    {
        builder.ToTable("ActivityEntrySegment", "app");
        builder.HasKey(s => s.ActivityEntrySegmentId);

        builder.Property(s => s.SegmentName).HasMaxLength(100).IsRequired();
        builder.Property(s => s.METValue).HasColumnType("decimal(8,3)");
        builder.Property(s => s.DurationMinutes).HasColumnType("decimal(10,2)");
        builder.Property(s => s.CalculatedCaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(s => s.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(s => new { s.ActivityEntryId, s.SegmentOrder })
               .IsUnique()
               .HasDatabaseName("UQ_ActivityEntrySegment_Order");

        builder.HasOne(s => s.ActivityEntry)
               .WithMany(a => a.Segments)
               .HasForeignKey(s => s.ActivityEntryId)
               .HasConstraintName("FK_ActivityEntrySegment_ActivityEntry")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
