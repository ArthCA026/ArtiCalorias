namespace Articalorias.Models.Entities;

public class FavoriteRoutineItem
{
    public long FavoriteRoutineItemId { get; set; }
    public long FavoriteRoutineId { get; set; }
    public string ItemType { get; set; } = string.Empty;  // "activity" | "food"
    public long? ActivityTemplateId { get; set; }
    public long? FoodTemplateId { get; set; }
    public int SortOrder { get; set; }

    // Navigation
    public FavoriteRoutine Routine { get; set; } = null!;
    public ActivityTemplate? ActivityTemplate { get; set; }
    public FoodTemplate? FoodTemplate { get; set; }
}
