using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class ActivityTemplateSegmentConfiguration : IEntityTypeConfiguration<ActivityTemplateSegment>
{
    public void Configure(EntityTypeBuilder<ActivityTemplateSegment> builder)
    {
        builder.ToTable("ActivityTemplateSegment", "app");
        builder.HasKey(s => s.ActivityTemplateSegmentId);

        builder.Property(s => s.SegmentName).HasMaxLength(100).IsRequired();
        builder.Property(s => s.METValue).HasColumnType("decimal(8,3)");
        builder.Property(s => s.DefaultDurationMinutes).HasColumnType("decimal(10,2)");
        builder.Property(s => s.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(s => new { s.ActivityTemplateId, s.SegmentOrder })
               .IsUnique()
               .HasDatabaseName("UQ_ActivityTemplateSegment_Order");

        builder.HasOne(s => s.ActivityTemplate)
               .WithMany(t => t.Segments)
               .HasForeignKey(s => s.ActivityTemplateId)
               .HasConstraintName("FK_ActivityTemplateSegment_Template")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
