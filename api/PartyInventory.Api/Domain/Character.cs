namespace PartyInventory.Api.Domain;

/// <summary>A player character (PC) belonging to a party, with its own inventory and money.</summary>
public class Character
{
    public Guid Id { get; set; }

    public Guid PartyId { get; set; }
    public Party Party { get; set; } = null!;

    public required string Name { get; set; }
    public string? Class { get; set; }
    public int? Level { get; set; }

    /// <summary>This character's personal money.</summary>
    public CoinPurse Coins { get; set; } = new();

    public List<Item> Items { get; set; } = [];

    // Stretch goal (identity): a nullable ClaimedByPlayerId will be added here to link a
    // character to the player who controls it, enabling restricted per-character permissions.
}
