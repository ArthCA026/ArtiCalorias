using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;

namespace Articalorias.DTOs.Favorites;

public class ParseFavoriteResponse
{
    public List<ParsedFavoriteItem> Items { get; set; } = [];
}

public class ParsedFavoriteItem
{
    public string Type { get; set; } = string.Empty;  // "activity" | "food"
    public ParsedActivityItem? Activity { get; set; }
    public ParsedFoodItem? Food { get; set; }
}
