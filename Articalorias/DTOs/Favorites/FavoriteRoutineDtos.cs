using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Favorites;

public class CreateFavoriteRoutineRequest
{
    [Required]
    [StringLength(150)]
    public string RoutineName { get; set; } = string.Empty;

    [MaxLength(20)]
    public List<CreateFavoriteRoutineItemRequest> Items { get; set; } = [];
}

public class CreateFavoriteRoutineItemRequest
{
    [Required]
    [StringLength(10)]
    public string ItemType { get; set; } = string.Empty;  // "activity" | "food"
    public long? ActivityTemplateId { get; set; }
    public long? FoodTemplateId { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateFavoriteRoutineRequest
{
    [Required]
    [StringLength(150)]
    public string RoutineName { get; set; } = string.Empty;

    [MaxLength(20)]
    public List<CreateFavoriteRoutineItemRequest> Items { get; set; } = [];
}

public class FavoriteRoutineResponse
{
    public long FavoriteRoutineId { get; set; }
    public string RoutineName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public List<FavoriteRoutineItemResponse> Items { get; set; } = [];
}

public class FavoriteRoutineItemResponse
{
    public long FavoriteRoutineItemId { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public object? ActivityTemplate { get; set; }
    public object? FoodTemplate { get; set; }
}

public class AddRoutineToTodayResponse
{
    public int AddedCount { get; set; }
    public List<SkippedRoutineItem> SkippedItems { get; set; } = [];
}

public class SkippedRoutineItem
{
    public long FavoriteRoutineItemId { get; set; }
    public string Reason { get; set; } = string.Empty;
}
