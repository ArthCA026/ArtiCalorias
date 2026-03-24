namespace Articalorias.Configuration;

/// <summary>
/// Global default activities that are automatically pre-populated
/// for every user on every new day.
/// Users can modify the duration or delete them within a day snapshot.
/// </summary>
public static class GlobalDefaultActivities
{
    public static readonly ActivityDefault Sleep = new("Sleep", 0.9m, 360m);
    public static readonly ActivityDefault NEAT = new("NEAT", 3.0m, 180m);

    public static IReadOnlyList<ActivityDefault> All { get; } = [Sleep, NEAT];

    public sealed record ActivityDefault(string Name, decimal METValue, decimal DefaultDurationMinutes);
}
