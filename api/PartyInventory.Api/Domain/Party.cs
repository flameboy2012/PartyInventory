namespace PartyInventory.Api.Domain;

/// <summary>A D&D party. Players join with the <see cref="JoinCode"/>; no accounts required.</summary>
public class Party
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    /// <summary>Short, unique code players enter to join the party.</summary>
    public required string JoinCode { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Money held in the shared party stash.</summary>
    public CoinPurse Coins { get; set; } = new();

    public List<Character> Characters { get; set; } = [];

    /// <summary>All items in this party. Stash items have <see cref="Item.CharacterId"/> set to null.</summary>
    public List<Item> Items { get; set; } = [];
}
