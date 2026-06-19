namespace PartyInventory.Api.Contracts;

/// <summary>Amounts of each coin to remove from a purse (each non-negative).</summary>
public record SpendCoinsRequest(int Copper, int Silver, int Electrum, int Gold, int Platinum);

/// <summary>
/// Move coins from one purse to another within a party. A null character id means the
/// party stash. The source is spent (breaking higher denominations as needed); the
/// destination receives the exact amounts.
/// </summary>
public record TransferCoinsRequest(
    Guid? FromCharacterId,
    Guid? ToCharacterId,
    int Copper,
    int Silver,
    int Electrum,
    int Gold,
    int Platinum);

/// <summary>The resulting source and destination purses after a transfer.</summary>
public record TransferCoinsResponse(CoinPurseDto From, CoinPurseDto To);
