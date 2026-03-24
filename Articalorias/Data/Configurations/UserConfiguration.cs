using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("User", "app");
        builder.HasKey(u => u.UserId);

        builder.Property(u => u.Username).HasMaxLength(100).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(255).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(500).IsRequired();
        builder.Property(u => u.PasswordSalt).HasMaxLength(250);
        builder.Property(u => u.IsActive).HasDefaultValue(true);
        builder.Property(u => u.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(u => u.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(u => u.RowVersion).IsRowVersion();

        builder.Property(u => u.PasswordResetToken).HasMaxLength(250);
        builder.Property(u => u.PasswordResetTokenExpiresAtUtc).HasColumnType("datetime2(0)");

        builder.HasIndex(u => u.Username).IsUnique().HasDatabaseName("UQ_User_Username");
        builder.HasIndex(u => u.Email).IsUnique().HasDatabaseName("UQ_User_Email");
    }
}
