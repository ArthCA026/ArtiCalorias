using Articalorias.Services.Macros;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Articalorias.Data.Conversions;

/// <summary>Stores a <see cref="MacroAmounts"/> map as JSON text in an nvarchar(max) column.</summary>
public sealed class MacroAmountsValueConverter : ValueConverter<MacroAmounts, string>
{
    public MacroAmountsValueConverter()
        : base(v => v.ToJson(), s => MacroAmounts.FromJson(s))
    {
    }
}

/// <summary>
/// Value equality for change tracking: EF only issues an UPDATE (and takes part
/// in the RowVersion concurrency check) when the map actually changed. The
/// type is immutable, so the snapshot is the instance itself.
/// </summary>
public sealed class MacroAmountsValueComparer : ValueComparer<MacroAmounts>
{
    public MacroAmountsValueComparer()
        : base((a, b) => object.Equals(a, b), v => v == null ? 0 : v.GetHashCode(), v => v)
    {
    }
}

public static class MacroAmountsPropertyBuilderExtensions
{
    public static PropertyBuilder<MacroAmounts> IsMacroAmountsJson(this PropertyBuilder<MacroAmounts> builder, string columnName)
        => builder
            .HasColumnName(columnName)
            .HasColumnType("nvarchar(max)")
            .IsRequired()
            .HasConversion(new MacroAmountsValueConverter(), new MacroAmountsValueComparer());
}
