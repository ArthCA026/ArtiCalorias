using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> builder)
    {
        builder.ToTable("UserProfile", "app");
        builder.HasKey(p => p.UserProfileId);

        builder.Property(p => p.CurrentWeightKg).HasColumnType("decimal(8,2)");
        builder.Property(p => p.HeightCm).HasColumnType("decimal(8,2)");
        builder.Property(p => p.Age);
        builder.Property(p => p.BiologicalSex).HasMaxLength(1);
        builder.Property(p => p.BMRKcal).HasColumnType("decimal(10,2)");
        builder.Property(p => p.BodyFatPercent).HasColumnType("decimal(5,2)");
        builder.Property(p => p.AutoCalculateBMR).HasDefaultValue(false);
        builder.Property(p => p.AutoCalculateBodyFat).HasDefaultValue(false);
        builder.Property(p => p.DailyBaseGoalKcal).HasColumnType("decimal(10,2)").HasDefaultValue(-500m);
        builder.Property(p => p.ProteinGoalGrams).HasColumnType("decimal(10,2)");
        builder.Property(p => p.AutoCalculateProteinGoal).HasDefaultValue(true);
        builder.Property(p => p.Country).HasMaxLength(100);
        builder.Property(p => p.IsOnboardingCompleted).HasDefaultValue(false);
        builder.Property(p => p.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(p => p.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(p => p.RowVersion).IsRowVersion();

        builder.HasIndex(p => p.UserId).IsUnique().HasDatabaseName("UQ_UserProfile_User");

        builder.HasOne(p => p.User)
               .WithOne(u => u.UserProfile)
               .HasForeignKey<UserProfile>(p => p.UserId)
               .HasConstraintName("FK_UserProfile_User");
    }
}
