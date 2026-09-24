using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class BillingPriceConfiguration : IEntityTypeConfiguration<BillingPrice>
{
    public void Configure(EntityTypeBuilder<BillingPrice> builder)
    {
        builder.ToTable("BillingPrice", "app");
        builder.HasKey(p => p.BillingPriceId);

        builder.Property(p => p.OnvoMode).HasMaxLength(8).IsRequired();
        builder.Property(p => p.PlanCode).HasMaxLength(16).IsRequired();
        builder.Property(p => p.Currency).HasMaxLength(3).IsRequired();
        builder.Property(p => p.OnvoProductId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.OnvoPriceId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");

        builder.HasIndex(p => new { p.OnvoMode, p.PlanCode, p.Currency, p.UnitAmountCents })
               .IsUnique()
               .HasDatabaseName("UX_BillingPrice_Mode_Plan_Currency_Amount");
    }
}
