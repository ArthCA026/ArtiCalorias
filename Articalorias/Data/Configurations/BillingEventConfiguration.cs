using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class BillingEventConfiguration : IEntityTypeConfiguration<BillingEvent>
{
    public void Configure(EntityTypeBuilder<BillingEvent> builder)
    {
        builder.ToTable("BillingEvent", "app");
        builder.HasKey(e => e.BillingEventId);

        builder.Property(e => e.EventType).HasMaxLength(40).IsRequired();
        builder.Property(e => e.DedupeKey).HasMaxLength(100);
        builder.Property(e => e.Detail).HasMaxLength(1000);
        builder.Property(e => e.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(e => new { e.UserId, e.CreatedAtUtc })
               .IsDescending(false, true)
               .HasDatabaseName("IX_BillingEvent_User_Created");

        builder.HasIndex(e => new { e.EventType, e.DedupeKey })
               .IsUnique()
               .HasFilter("[DedupeKey] IS NOT NULL")
               .HasDatabaseName("UX_BillingEvent_Type_DedupeKey");

        builder.HasOne(e => e.User)
               .WithMany()
               .HasForeignKey(e => e.UserId)
               .HasConstraintName("FK_BillingEvent_User")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
