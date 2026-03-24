using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IUserService
{
    Task<User?> GetByIdAsync(long userId);
    Task<User?> GetByUsernameAsync(string username);
}
