namespace Articalorias.Models.Entities;

/// <summary>
/// Cache of the ONVO product/price pair behind each catalogue plan, created
/// lazily by the first checkout. Keyed by mode AND amount, so a test-mode id is
/// never sent with a live key and a price change mints a new ONVO price
/// instead of silently reusing the old one. Not user data.
/// </summary>
public class BillingPrice
{
    public int BillingPriceId { get; set; }
    public string OnvoMode { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public int UnitAmountCents { get; set; }
    public string OnvoProductId { get; set; } = string.Empty;
    public string OnvoPriceId { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}
