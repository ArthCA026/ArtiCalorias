using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Articalorias.DTOs.Push;

public record NotificationScheduleDto(
    [property: JsonPropertyName("type")]
    [property: Required, StringLength(20)]
    string Type,       // "breakfast" | "lunch" | "dinner"

    [property: JsonPropertyName("enabled")]
    bool Enabled,

    [property: JsonPropertyName("hourUtc")]
    [property: Range(0, 23)]
    int HourUtc,

    [property: JsonPropertyName("minuteUtc")]
    [property: Range(0, 59)]
    int MinuteUtc
);
