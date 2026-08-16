using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class BodyMeasurementConfiguration : IEntityTypeConfiguration<BodyMeasurement>
{
    public void Configure(EntityTypeBuilder<BodyMeasurement> builder)
    {
        builder.ToTable("BodyMeasurement", "app");
        builder.HasKey(m => m.BodyMeasurementId);

        builder.Property(m => m.WeightKg).HasColumnType("decimal(8,2)");
        builder.Property(m => m.BodyFatPercent).HasColumnType("decimal(5,2)");
        builder.Property(m => m.Source).HasMaxLength(20).HasDefaultValue("manual").IsRequired();
        builder.Property(m => m.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.RowVersion).IsRowVersion();

        builder.HasIndex(m => new { m.UserId, m.MeasuredOn })
               .IsUnique()
               .HasDatabaseName("UQ_BodyMeasurement_User_Date");

        builder.HasOne(m => m.User)
               .WithMany()
               .HasForeignKey(m => m.UserId)
               .HasConstraintName("FK_BodyMeasurement_User")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
