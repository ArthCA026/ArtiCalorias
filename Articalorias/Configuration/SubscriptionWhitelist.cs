namespace Articalorias.Configuration;

/// <summary>
/// Accounts that may use ArtiCalorias WITHOUT a paid subscription.
///
/// This list lives in code on purpose: there is no endpoint, no database row
/// and no configuration value that can grant free access, so the only way to
/// add someone is to edit this file and redeploy the API.
///
/// Entries are UserIds (the [app].[User].[UserId] identity column), not emails
/// or usernames: an id is assigned by the server, can never be changed by the
/// user, and is never reused after an account is deleted. An email would let
/// whoever registers that address first inherit the free access.
///
/// To find an id:
///     SELECT UserId, Username, Email FROM [app].[User] ORDER BY UserId;
///
/// Ids are per database: the local SQL Express ids are not the Azure ids.
/// Removing an entry takes effect within a few minutes of the deploy (the
/// access check is cached briefly); the account then sees the paywall like
/// everyone else and keeps all its data.
/// </summary>
public static class SubscriptionWhitelist
{
    private static readonly HashSet<long> UserIds =
    [
        // 1,   // Arturo
        // 2,   // family member
    ];

    public static bool Contains(long userId) => UserIds.Contains(userId);
}
