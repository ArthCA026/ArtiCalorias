namespace Articalorias.Models.Entities;

public enum ReminderType { Breakfast = 1, Lunch = 2, Dinner = 3 }

public class NotificationSchedule
{
    public long NotificationScheduleId { get; set; }
    public long UserId { get; set; }
    public ReminderType Type { get; set; }
    public bool Enabled { get; set; }
    public int HourUtc { get; set; }
    public int MinuteUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
