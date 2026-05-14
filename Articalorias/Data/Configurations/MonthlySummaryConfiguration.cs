using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class MonthlySummaryConfiguration : IEntityTypeConfiguration<MonthlySummary>
{
    public void Configure(EntityTypeBuilder<MonthlySummary> builder)
    {
        builder.ToTable("MonthlySummary", "app");
        builder.HasKey(m => m.MonthlySummaryId);

        builder.Property(m => m.CreatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.UpdatedAtUtc).HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(m => m.RowVersion).IsRowVersion();

        builder.HasIndex(m => new { m.UserId, m.YearNumber, m.MonthNumber })
               .IsUnique()
               .HasDatabaseName("UQ_MonthlySummary_User_Year_Month");
        builder.HasIndex(m => new { m.UserId, m.YearNumber, m.MonthNumber })
               .HasDatabaseName("IX_MonthlySummary_User_Year_Month");

        builder.HasOne(m => m.User)
               .WithMany(u => u.MonthlySummaries)
               .HasForeignKey(m => m.UserId)
               .HasConstraintName("FK_MonthlySummary_User");
    }
}
