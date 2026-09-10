using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class AiResponseCacheConfiguration : IEntityTypeConfiguration<AiResponseCacheEntry>
{
    public void Configure(EntityTypeBuilder<AiResponseCacheEntry> builder)
    {
        builder.ToTable("AiResponseCache", "app");
        builder.HasKey(c => c.CacheKeyHash);

        builder.Property(c => c.CacheKeyHash)
               .HasMaxLength(64)
               .IsFixedLength()
               .IsUnicode(false);

        builder.Property(c => c.CacheType).HasMaxLength(20).IsRequired();
        builder.Property(c => c.ResponseJson).IsRequired();
        builder.Property(c => c.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(c => c.ExpiresAtUtc).HasColumnType("datetime2(0)");
        builder.Property(c => c.LastHitAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(c => c.ExpiresAtUtc)
               .HasDatabaseName("IX_AiResponseCache_Expires")
               .HasFilter("[ExpiresAtUtc] IS NOT NULL");
    }
}
