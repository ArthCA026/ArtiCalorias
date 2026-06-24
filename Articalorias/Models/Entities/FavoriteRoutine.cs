namespace Articalorias.Models.Entities;

public class FavoriteRoutine
{
    public long FavoriteRoutineId { get; set; }
    public long UserId { get; set; }
    public string RoutineName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<FavoriteRoutineItem> Items { get; set; } = [];
}
