using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class FavoriteRoutineItemConfiguration : IEntityTypeConfiguration<FavoriteRoutineItem>
{
    public void Configure(EntityTypeBuilder<FavoriteRoutineItem> builder)
    {
        builder.ToTable("FavoriteRoutineItem", "app");
        builder.HasKey(i => i.FavoriteRoutineItemId);

        builder.Property(i => i.ItemType).HasMaxLength(10).IsUnicode(false).IsRequired();
        builder.Property(i => i.SortOrder).HasDefaultValue(0);

        builder.HasOne(i => i.Routine)
               .WithMany(r => r.Items)
               .HasForeignKey(i => i.FavoriteRoutineId)
               .HasConstraintName("FK_FavoriteRoutineItem_Routine")
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.ActivityTemplate)
               .WithMany()
               .HasForeignKey(i => i.ActivityTemplateId)
               .HasConstraintName("FK_FavoriteRoutineItem_Activity")
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(i => i.FoodTemplate)
               .WithMany()
               .HasForeignKey(i => i.FoodTemplateId)
               .HasConstraintName("FK_FavoriteRoutineItem_Food")
               .OnDelete(DeleteBehavior.SetNull);
    }
}
