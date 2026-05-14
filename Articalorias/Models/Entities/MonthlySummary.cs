namespace Articalorias.Models.Entities;

public class MonthlySummary
{
    public long MonthlySummaryId { get; set; }
    public long UserId { get; set; }
    public int YearNumber { get; set; }
    public int MonthNumber { get; set; }
    public DateOnly MonthStartDate { get; set; }
    public DateOnly MonthEndDate { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
