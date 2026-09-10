using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Articalorias.Services;

/// <summary>
/// Builds deterministic cache keys for AI parsing. Everything that changes the
/// model's answer must be part of the key; the hash keeps raw user text out of
/// the database.
/// </summary>
public static partial class AiCacheKey
{
    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRuns();

    /// <summary>
    /// Canonical form of free text for exact-match caching: trimmed, lowercase
    /// (invariant), inner whitespace collapsed. Numbers are left untouched on
    /// purpose — "2 eggs" and "12 eggs" must never share a cache entry.
    /// </summary>
    public static string NormalizeText(string text)
        => WhitespaceRuns().Replace(text.Trim(), " ").ToLowerInvariant();

    /// <summary>SHA-256 over the joined key parts, lowercase hex (64 chars).</summary>
    public static string Compute(params string?[] parts)
    {
        var material = string.Join('\x1f', parts.Select(p => p ?? string.Empty));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(material));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
