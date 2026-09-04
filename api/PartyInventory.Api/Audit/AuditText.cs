using PartyInventory.Api.Contracts;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Audit;

/// <summary>
/// Renders the one-line summary stored on an audit entry. Written at the moment of the change,
/// in the player's vocabulary rather than the schema's: no ids, no actor, no timestamp, no
/// trailing punctuation.
/// </summary>
public static class AuditText
{
    /// <summary>What the shared party purse is called in a summary.</summary>
    public const string Stash = "the party stash";

    /// <summary>
    /// Coin amounts high denomination first, e.g. <c>3 gp</c> or <c>1 pp, 5 sp</c>. Zero amounts
    /// are left out, so the text says what moved rather than listing every denomination.
    /// </summary>
    public static string Coins(int copper, int silver, int electrum, int gold, int platinum)
    {
        var parts = new List<string>(5);
        Add(platinum, "pp");
        Add(gold, "gp");
        Add(electrum, "ep");
        Add(silver, "sp");
        Add(copper, "cp");

        return parts.Count == 0 ? "no coins" : string.Join(", ", parts);

        void Add(int amount, string unit)
        {
            if (amount != 0)
            {
                parts.Add($"{amount} {unit}");
            }
        }
    }

    public static string Coins(CoinPurseDto coins) =>
        Coins(coins.Copper, coins.Silver, coins.Electrum, coins.Gold, coins.Platinum);

    public static string Coins(SpendCoinsRequest spend) =>
        Coins(spend.Copper, spend.Silver, spend.Electrum, spend.Gold, spend.Platinum);

    public static string Coins(TransferCoinsRequest transfer) =>
        Coins(transfer.Copper, transfer.Silver, transfer.Electrum, transfer.Gold, transfer.Platinum);

    /// <summary>Names the holder of a purse or an item: a character, or the shared stash.</summary>
    public static string Holder(Party party, Guid? characterId) =>
        characterId is null
            ? Stash
            : party.Characters.FirstOrDefault(c => c.Id == characterId)?.Name ?? "an unknown character";
}
