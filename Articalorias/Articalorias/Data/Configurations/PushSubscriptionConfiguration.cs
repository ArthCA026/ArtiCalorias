using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class PushSubscriptionConfiguration : IEntityTypeConfiguration<PushSubscription>
{
    public void Configure(EntityTypeBuilder<PushSubscription> builder)
    {
        builder.HasKey(p => p.PushSubscriptionId);

        builder.Property(p => p.Endpoint).IsRequired().HasMaxLength(2048);
        builder.Property(p => p.P256DH).IsRequired().HasMaxLength(512);
        builder.Property(p => p.Auth).IsRequired().HasMaxLength(256);
        builder.Property(p => p.CreatedAtUtc).IsRequired();

        builder.HasIndex(p => p.Endpoint).IsUnique();

        builder.HasOne(p => p.User)
               .WithMany(u => u.PushSubscriptions)
               .HasForeignKey(p => p.UserId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
