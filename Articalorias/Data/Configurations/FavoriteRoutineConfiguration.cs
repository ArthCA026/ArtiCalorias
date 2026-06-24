using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class FavoriteRoutineConfiguration : IEntityTypeConfiguration<FavoriteRoutine>
{
    public void Configure(EntityTypeBuilder<FavoriteRoutine> builder)
    {
        builder.ToTable("FavoriteRoutine", "app");
        builder.HasKey(r => r.FavoriteRoutineId);

        builder.Property(r => r.RoutineName).HasMaxLength(150).IsRequired();
        builder.Property(r => r.SortOrder).HasDefaultValue(0);
        builder.Property(r => r.IsActive).HasDefaultValue(true);
        builder.Property(r => r.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(r => r.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(r => r.RowVersion).IsRowVersion();

        builder.HasIndex(r => new { r.UserId, r.IsActive })
               .HasDatabaseName("IX_FavoriteRoutine_UserId");

        builder.HasOne(r => r.User)
               .WithMany(u => u.FavoriteRoutines)
               .HasForeignKey(r => r.UserId)
               .HasConstraintName("FK_FavoriteRoutine_User");
    }
}
