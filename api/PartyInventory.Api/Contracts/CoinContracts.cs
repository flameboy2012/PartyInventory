namespace PartyInventory.Api.Contracts;

/// <summary>Amounts of each coin to remove from a purse (each non-negative).</summary>
public record SpendCoinsRequest(int Copper, int Silver, int Electrum, int Gold, int Platinum);
