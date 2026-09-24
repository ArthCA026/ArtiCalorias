namespace Articalorias.Services.Billing;

/// <summary>
/// One purchasable plan. Amounts are integers in the currency's minor unit
/// (US cents), exactly as ONVO expects them.
/// </summary>
public sealed record BillingPlan(string Code, int PriceCents, string Currency, string OnvoInterval)
{
    /// <summary>Longest a single paid period of this plan can legitimately last.</summary>
    public TimeSpan MaxPeriod => OnvoInterval == "year" ? TimeSpan.FromDays(366) : TimeSpan.FromDays(31);

    /// <summary>Period length used only when ONVO reports a paid invoice without usable dates.</summary>
    public DateTime AddOnePeriod(DateTime fromUtc) =>
        OnvoInterval == "year" ? fromUtc.AddYears(1) : fromUtc.AddMonths(1);
}

/// <summary>
/// The subscription catalogue: the single source of truth for what ArtiCalorias
/// costs. The client renders prices from GET api/billing/status, so changing a
/// number here changes it everywhere.
///
/// Changing a price never touches existing subscribers: each subscription row
/// stores the price it was sold at, ONVO keeps renewing it at that price, and a
/// new ONVO price object is created on demand for new purchases (the
/// [app].[BillingPrice] cache is keyed by amount). Raising the price for
/// existing subscribers is a legal process (advance notice), not a code edit.
/// </summary>
public static class BillingPlans
{
    public const string Currency = "USD";

    public const string MonthlyCode = "monthly";
    public const string YearlyCode = "yearly";

    public static readonly BillingPlan Monthly = new(MonthlyCode, 999, Currency, "month");
    public static readonly BillingPlan Yearly = new(YearlyCode, 2999, Currency, "year");

    public static readonly IReadOnlyList<BillingPlan> All = [Yearly, Monthly];

    /// <summary>
    /// Days a subscriber keeps access after a paid period ends while ONVO is
    /// still expected to collect the renewal. Covers a late or lost webhook and
    /// gives a declined card time to be fixed instead of locking a paying user
    /// out at midnight. Never applied once the user cancelled (nothing is
    /// coming) or after ONVO gave up on the charge.
    /// </summary>
    public const int RenewalGraceDays = 3;

    public static BillingPlan? Find(string? code) =>
        All.FirstOrDefault(p => string.Equals(p.Code, code, StringComparison.Ordinal));
}
