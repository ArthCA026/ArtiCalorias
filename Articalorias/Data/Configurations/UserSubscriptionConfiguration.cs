using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class UserSubscriptionConfiguration : IEntityTypeConfiguration<UserSubscription>
{
    public void Configure(EntityTypeBuilder<UserSubscription> builder)
    {
        builder.ToTable("UserSubscription", "app");
        builder.HasKey(s => s.UserSubscriptionId);

        builder.Property(s => s.OnvoMode).HasMaxLength(8).IsRequired();
        builder.Property(s => s.OnvoCustomerId).HasMaxLength(64).IsRequired();
        builder.Property(s => s.OnvoSubscriptionId).HasMaxLength(64).IsRequired();
        builder.Property(s => s.PlanCode).HasMaxLength(16).IsRequired();
        builder.Property(s => s.Currency).HasMaxLength(3).IsRequired();
        builder.Property(s => s.Status).HasMaxLength(24).IsRequired();
        builder.Property(s => s.LastPaymentIntentId).HasMaxLength(64);

        builder.Property(s => s.CurrentPeriodStartUtc).HasColumnType("datetime2(0)");
        builder.Property(s => s.CurrentPeriodEndUtc).HasColumnType("datetime2(0)");
        builder.Property(s => s.PaidThroughUtc).HasColumnType("datetime2(0)");
        builder.Property(s => s.CanceledAtUtc).HasColumnType("datetime2(0)");
        builder.Property(s => s.LastSyncedAtUtc).HasColumnType("datetime2(0)");
        builder.Property(s => s.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(s => s.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(s => s.OnvoSubscriptionId)
               .IsUnique()
               .HasDatabaseName("UX_UserSubscription_OnvoSubscriptionId");

        builder.HasIndex(s => new { s.UserId, s.OnvoMode, s.CreatedAtUtc })
               .IsDescending(false, false, true)
               .HasDatabaseName("IX_UserSubscription_User_Mode_Created");

        builder.HasIndex(s => s.OnvoCustomerId)
               .HasDatabaseName("IX_UserSubscription_OnvoCustomerId");

        builder.HasOne(s => s.User)
               .WithMany()
               .HasForeignKey(s => s.UserId)
               .HasConstraintName("FK_UserSubscription_User")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
