using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Push;

public record UpdateSchedulesRequest(
    [property: Required, MaxLength(10)] List<NotificationScheduleDto> Schedules);
