using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Articalorias.Data.Configurations;

public class NotificationScheduleConfiguration : IEntityTypeConfiguration<NotificationSchedule>
{
    public void Configure(EntityTypeBuilder<NotificationSchedule> builder)
    {
        builder.HasKey(n => n.NotificationScheduleId);

        builder.Property(n => n.Type).IsRequired();
        builder.Property(n => n.Enabled).IsRequired();
        builder.Property(n => n.HourUtc).IsRequired();
        builder.Property(n => n.MinuteUtc).IsRequired();
        builder.Property(n => n.UpdatedAtUtc).IsRequired();

        // One row per user per reminder type
        builder.HasIndex(n => new { n.UserId, n.Type }).IsUnique();

        builder.HasOne(n => n.User)
               .WithMany(u => u.NotificationSchedules)
               .HasForeignKey(n => n.UserId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
