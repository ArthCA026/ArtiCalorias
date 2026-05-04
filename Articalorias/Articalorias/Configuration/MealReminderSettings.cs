namespace Articalorias.Configuration;

public class MealReminderSettings
{
    public const string SectionName = "MealReminders";

    public int LunchUtcHour { get; set; } = 14;
    public int LunchUtcMinute { get; set; } = 0;
    public int DinnerUtcHour { get; set; } = 21;
    public int DinnerUtcMinute { get; set; } = 0;
}
