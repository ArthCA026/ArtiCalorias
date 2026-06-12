using System.Text.Json.Serialization;

namespace Articalorias.DTOs.Push;

public record NotificationScheduleDto(
    [property: JsonPropertyName("type")]    string Type,       // "breakfast" | "lunch" | "dinner"
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("hourUtc")] int HourUtc,
    [property: JsonPropertyName("minuteUtc")] int MinuteUtc
);
