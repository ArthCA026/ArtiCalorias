using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IUserProfileService
{
    Task<UserProfile?> GetByUserIdAsync(long userId);
    Task<UserProfile> CreateOrUpdateAsync(long userId, UserProfile profile);
}
