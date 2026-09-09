using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IUserService
{
    Task<User?> GetByIdAsync(long userId);
    Task<User?> GetByUsernameAsync(string username);

    /// <summary>Deletes all daily logs (and their food/activity entries) and monthly
    /// summaries for the user. Profile and account are kept.</summary>
    Task ClearHistoryAsync(long userId);

    /// <summary>Permanently deletes the user account and all associated data.</summary>
    Task DeleteAccountAsync(long userId);

    /// <summary>Everything the account holds, as one JSON-serializable object
    /// (Ley 8968 access right). Credential fields are excluded by construction.
    /// Null when the user does not exist.</summary>
    Task<object?> ExportAsync(long userId);
}
