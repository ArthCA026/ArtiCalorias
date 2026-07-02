using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens", "app");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.TokenHash).HasMaxLength(256).IsRequired();
        builder.Property(r => r.ExpiresAtUtc).HasColumnType("datetime2(0)").IsRequired();
        builder.Property(r => r.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(r => r.RevokedAtUtc).HasColumnType("datetime2(0)");

        builder.HasIndex(r => r.TokenHash)
            .IsUnique()
            .HasDatabaseName("UQ_RefreshTokens_TokenHash");

        builder.HasIndex(r => new { r.UserId, r.ExpiresAtUtc })
            .HasDatabaseName("IX_RefreshTokens_UserId_ExpiresAtUtc");

        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
