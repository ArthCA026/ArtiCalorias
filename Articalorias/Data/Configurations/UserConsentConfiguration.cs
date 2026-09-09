using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class UserConsentConfiguration : IEntityTypeConfiguration<UserConsent>
{
    public void Configure(EntityTypeBuilder<UserConsent> builder)
    {
        builder.ToTable("UserConsent", "app");
        builder.HasKey(c => c.UserConsentId);

        builder.Property(c => c.ConsentType).HasMaxLength(30).IsRequired();
        builder.Property(c => c.PolicyVersion).HasMaxLength(20).IsRequired();
        builder.Property(c => c.Action).HasMaxLength(10).IsRequired();
        builder.Property(c => c.Locale).HasMaxLength(5).IsRequired();
        builder.Property(c => c.Source).HasMaxLength(20).IsRequired();
        builder.Property(c => c.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(c => new { c.UserId, c.ConsentType, c.CreatedAtUtc })
               .IsDescending(false, false, true)
               .HasDatabaseName("IX_UserConsent_User_Type_Created");

        builder.HasOne(c => c.User)
               .WithMany()
               .HasForeignKey(c => c.UserId)
               .HasConstraintName("FK_UserConsent_User")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
