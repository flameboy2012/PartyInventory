using PartyInventory.Api.Contracts;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Endpoints;

/// <summary>Shared validation/mapping for the coin-purse endpoints.</summary>
internal static class CoinUpdates
{
    // How many of the next-lower denomination one of the next-higher breaks into:
    // cp per sp, sp per ep, ep per gp, gp per pp.  (D&D 5e: 1 pp = 10 gp, 1 gp = 2 ep, 1 ep = 5 sp, 1 sp = 10 cp)
    private static readonly int[] LowerPerHigher = [10, 5, 2, 10];

    public static Dictionary<string, string[]> Validate(CoinPurseDto coins) =>
        ValidateNonNegative(
            coins.Copper, coins.Silver, coins.Electrum, coins.Gold, coins.Platinum,
            "Coin amounts cannot be negative.");

    public static Dictionary<string, string[]> ValidateSpend(SpendCoinsRequest spend) =>
        ValidateNonNegative(
            spend.Copper, spend.Silver, spend.Electrum, spend.Gold, spend.Platinum,
            "Spend amounts cannot be negative.");

    public static Dictionary<string, string[]> ValidateTransfer(TransferCoinsRequest transfer) =>
        ValidateNonNegative(
            transfer.Copper, transfer.Silver, transfer.Electrum, transfer.Gold, transfer.Platinum,
            "Transfer amounts cannot be negative.");

    public static CoinPurseDto ToDto(CoinPurse purse) =>
        new(purse.Copper, purse.Silver, purse.Electrum, purse.Gold, purse.Platinum);

    public static void Add(CoinPurse purse, int copper, int silver, int electrum, int gold, int platinum)
    {
        purse.Copper += copper;
        purse.Silver += silver;
        purse.Electrum += electrum;
        purse.Gold += gold;
        purse.Platinum += platinum;
    }

    public static void Apply(CoinPurse purse, CoinPurseDto coins)
    {
        purse.Copper = coins.Copper;
        purse.Silver = coins.Silver;
        purse.Electrum = coins.Electrum;
        purse.Gold = coins.Gold;
        purse.Platinum = coins.Platinum;
    }

    /// <summary>
    /// Attempts to remove the given coins from the purse, breaking higher denominations
    /// down to cover any shortfall (cascading upward). Returns false and leaves the purse
    /// unchanged if the total value isn't enough. On success the purse is updated in place.
    /// </summary>
    public static bool TrySpend(CoinPurse purse, SpendCoinsRequest spend)
    {
        // Index 0..4 = copper, silver, electrum, gold, platinum.
        long[] result =
        [
            purse.Copper - (long)spend.Copper,
            purse.Silver - (long)spend.Silver,
            purse.Electrum - (long)spend.Electrum,
            purse.Gold - (long)spend.Gold,
            purse.Platinum - (long)spend.Platinum,
        ];

        // Cover any shortfall by breaking the next-higher denomination down (cascades up).
        for (var i = 0; i < LowerPerHigher.Length; i++)
        {
            if (result[i] < 0)
            {
                var deficit = -result[i];
                var rate = LowerPerHigher[i];
                var higherNeeded = (deficit + rate - 1) / rate; // ceil
                result[i] += higherNeeded * rate;
                result[i + 1] -= higherNeeded;
            }
        }

        if (result[4] < 0)
        {
            return false; // not enough total value, even after breaking everything down
        }

        purse.Copper = (int)result[0];
        purse.Silver = (int)result[1];
        purse.Electrum = (int)result[2];
        purse.Gold = (int)result[3];
        purse.Platinum = (int)result[4];
        return true;
    }

    private static Dictionary<string, string[]> ValidateNonNegative(
        int copper, int silver, int electrum, int gold, int platinum, string message)
    {
        var errors = new Dictionary<string, string[]>();

        void Check(int value, string key)
        {
            if (value < 0)
            {
                errors[key] = [message];
            }
        }

        Check(copper, "copper");
        Check(silver, "silver");
        Check(electrum, "electrum");
        Check(gold, "gold");
        Check(platinum, "platinum");

        return errors;
    }
}
