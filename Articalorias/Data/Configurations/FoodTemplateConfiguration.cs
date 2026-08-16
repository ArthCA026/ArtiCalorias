using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class FoodTemplateConfiguration : IEntityTypeConfiguration<FoodTemplate>
{
    public void Configure(EntityTypeBuilder<FoodTemplate> builder)
    {
        builder.ToTable("FoodTemplate", "app");
        builder.HasKey(f => f.FoodTemplateId);

        builder.Property(f => f.TemplateName).HasMaxLength(150).IsRequired();
        builder.Property(f => f.PortionDescription).HasMaxLength(100).IsRequired();
        builder.Property(f => f.DefaultQuantity).HasColumnType("decimal(10,3)").HasDefaultValue(1m);
        builder.Property(f => f.CaloriesKcal).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.ProteinGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.FatGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.CarbsGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.AlcoholGrams).HasColumnType("decimal(10,2)").HasDefaultValue(0m);
        builder.Property(f => f.SugarGrams).HasColumnType("decimal(10,2)");
        builder.Property(f => f.WaterMl).HasColumnType("decimal(10,2)");
        builder.Property(f => f.AutoAddToNewDay).HasDefaultValue(false);
        builder.Property(f => f.IsActive).HasDefaultValue(true);
        builder.Property(f => f.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(f => f.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(f => f.RowVersion).IsRowVersion();

        builder.HasIndex(f => new { f.UserId, f.IsActive, f.TemplateName })
               .HasDatabaseName("IX_FoodTemplate_UserId");

        builder.HasOne(f => f.User)
               .WithMany(u => u.FoodTemplates)
               .HasForeignKey(f => f.UserId)
               .HasConstraintName("FK_FoodTemplate_User");
    }
}
