using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class UserStreakConfiguration : IEntityTypeConfiguration<UserStreak>
{
    public void Configure(EntityTypeBuilder<UserStreak> builder)
    {
        builder.ToTable("UserStreaks", "app");
        builder.HasKey(s => s.UserStreakId);

        builder.Property(s => s.StreakEnabled).HasDefaultValue(true);
        builder.Property(s => s.CurrentStreak).HasDefaultValue(0);
        builder.Property(s => s.LongestStreak).HasDefaultValue(0);
        builder.Property(s => s.LastLoggedDate);
        builder.Property(s => s.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(s => s.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(s => s.RowVersion).IsRowVersion();

        builder.HasIndex(s => s.UserId)
               .IsUnique()
               .HasDatabaseName("IX_UserStreaks_UserId");

        builder.HasOne(s => s.User)
               .WithMany()
               .HasForeignKey(s => s.UserId)
               .OnDelete(DeleteBehavior.Cascade)
               .HasConstraintName("FK_UserStreaks_User");
    }
}
