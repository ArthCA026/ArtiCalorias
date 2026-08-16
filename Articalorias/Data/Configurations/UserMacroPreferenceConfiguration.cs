using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class UserMacroPreferenceConfiguration : IEntityTypeConfiguration<UserMacroPreference>
{
    public void Configure(EntityTypeBuilder<UserMacroPreference> builder)
    {
        builder.ToTable("UserMacroPreference", "app");
        builder.HasKey(m => m.UserMacroPreferenceId);

        builder.Property(m => m.MacroKey).HasMaxLength(20).IsRequired();
        builder.Property(m => m.IsTracked).HasDefaultValue(false);
        builder.Property(m => m.TargetMode).HasMaxLength(10).HasDefaultValue("auto").IsRequired();
        builder.Property(m => m.CustomTargetValue).HasColumnType("decimal(10,2)");
        builder.Property(m => m.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.RowVersion).IsRowVersion();

        builder.HasIndex(m => new { m.UserId, m.MacroKey })
               .IsUnique()
               .HasDatabaseName("UQ_UserMacroPreference_User_Macro");

        builder.HasOne(m => m.User)
               .WithMany()
               .HasForeignKey(m => m.UserId)
               .HasConstraintName("FK_UserMacroPreference_User")
               .OnDelete(DeleteBehavior.Cascade);
    }
}
