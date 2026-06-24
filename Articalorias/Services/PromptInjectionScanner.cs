using System.Text;
using System.Text.RegularExpressions;

namespace Articalorias.Services;

/// <summary>
/// Lightweight scanner that detects known prompt-injection patterns in free-text
/// inputs before they are forwarded to OpenAI. Constitution Principle IX compliance:
/// the model is untrusted; all user input is untrusted.
/// </summary>
public static class PromptInjectionScanner
{
    private static readonly Regex[] Patterns =
    [
        // "ignore (all) previous / prior instructions / prompts / rules"
        new Regex(
            @"\bignore\s+(all\s+)?(previous|prior)\s+(instructions?|prompts?|context|rules?|constraints?)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "forget (all) (previous) instructions"
        new Regex(
            @"\bforget\s+(all\s+)?(previous\s+)?(instructions?|prompts?|context|rules?)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "you are now"
        new Regex(
            @"\byou\s+are\s+now\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "act as (a|an) <anything>"
        new Regex(
            @"\bact\s+as\s+(a\s+|an\s+)?\w",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "pretend you are" / "pretend to be"
        new Regex(
            @"\bpretend\s+(you\s+are|to\s+be)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "roleplay as"
        new Regex(
            @"\broleplay\s+as\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "new system prompt" / "your new instructions"
        new Regex(
            @"\b(new\s+system\s+prompt|your\s+new\s+instructions?)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "override (your) (previous) instructions / rules"
        new Regex(
            @"\boverride\s+(your\s+)?(previous\s+)?(instructions?|rules?|prompts?)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "disregard (all|any|previous|your) ..."
        new Regex(
            @"\bdisregard\s+(all|any|previous|your)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // DAN / jailbreak keywords
        new Regex(
            @"\b(jailbreak|do\s+anything\s+now)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // Role-switch injection markers: [SYSTEM], [INST], <system>, </instructions>
        new Regex(
            @"(\[SYSTEM\]|\[INST\]|<\s*system\s*>|<\s*/?\s*instructions?\s*>)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // "from now on (you|your|act|behave|ignore|be) ..."
        new Regex(
            @"\bfrom\s+now\s+on\s+(you|your|act|behave|ignore|be)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),
    ];

    /// <summary>
    /// Returns <c>true</c> if the input contains a known prompt injection pattern.
    /// Returns <c>false</c> for null or whitespace-only input.
    /// </summary>
    public static bool ContainsInjection(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return false;
        return Array.Exists(Patterns, p => p.IsMatch(input));
    }

    /// <summary>
    /// Returns a safe, truncated representation of the input suitable for log messages.
    /// Strips non-printable control characters and caps length to prevent log flooding.
    /// </summary>
    public static string SanitizeForLog(string input, int maxLength = 200)
    {
        var sb = new StringBuilder(Math.Min(input.Length, maxLength));
        var count = 0;
        foreach (var ch in input)
        {
            if (count >= maxLength) break;
            if (ch >= 0x20 || ch == '\t') // keep printable ASCII and tab
                sb.Append(ch);
            count++;
        }
        if (input.Length > maxLength)
            sb.Append('…');
        return sb.ToString();
    }
}
