namespace PartyInventory.Api.Domain;

/// <summary>
/// Coins held by a party stash or a character, in D&D denominations.
/// Modeled as an owned (embedded) value object — stored as columns on the owner's table.
/// </summary>
public class CoinPurse
{
    public int Copper { get; set; }
    public int Silver { get; set; }
    public int Electrum { get; set; }
    public int Gold { get; set; }
    public int Platinum { get; set; }

    /// <summary>Total value of all coins expressed in gold pieces (1 pp = 10 gp, 1 ep = 0.5 gp, 1 sp = 0.1 gp, 1 cp = 0.01 gp).</summary>
    public decimal TotalGoldValue =>
        Platinum * 10m + Gold + Electrum * 0.5m + Silver * 0.1m + Copper * 0.01m;
}
