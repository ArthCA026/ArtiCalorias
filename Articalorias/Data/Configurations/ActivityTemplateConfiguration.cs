using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class ActivityTemplateConfiguration : IEntityTypeConfiguration<ActivityTemplate>
{
    public void Configure(EntityTypeBuilder<ActivityTemplate> builder)
    {
        builder.ToTable("ActivityTemplate", "app");
        builder.HasKey(a => a.ActivityTemplateId);

        builder.Property(a => a.TemplateScope).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(a => a.ActivityType).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(a => a.TemplateName).HasMaxLength(150).IsRequired();

        builder.Property(a => a.AutoAddToNewDay).HasDefaultValue(false);
        builder.Property(a => a.IsActive).HasDefaultValue(true);

        builder.Property(a => a.DefaultDurationMinutes).HasColumnType("decimal(10,2)");
        builder.Property(a => a.DefaultDirectCaloriesKcal).HasColumnType("decimal(10,2)");
        builder.Property(a => a.DefaultMET).HasColumnType("decimal(8,3)");

        builder.Property(a => a.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(a => a.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(a => a.RowVersion).IsRowVersion();

        builder.HasIndex(a => new { a.UserId, a.IsActive, a.TemplateName }).HasDatabaseName("IX_ActivityTemplate_UserId");

        builder.HasOne(a => a.User)
               .WithMany(u => u.ActivityTemplates)
               .HasForeignKey(a => a.UserId)
               .HasConstraintName("FK_ActivityTemplate_User");
    }
}
