namespace PartyInventory.Api.Domain;

/// <summary>An inventory item, held either in the party stash or by a specific character.</summary>
public class Item
{
    public Guid Id { get; set; }

    public Guid PartyId { get; set; }
    public Party Party { get; set; } = null!;

    /// <summary>Owning character, or null when the item sits in the shared party stash.</summary>
    public Guid? CharacterId { get; set; }
    public Character? Character { get; set; }

    public required string Name { get; set; }
    public string? Description { get; set; }
    public int Quantity { get; set; } = 1;

    /// <summary>Cost in gold pieces (gp). The display layer converts this to a coin breakdown.</summary>
    public decimal ValueGp { get; set; }

    /// <summary>Weight in pounds (lb).</summary>
    public decimal Weight { get; set; }

    public ItemType Type { get; set; } = ItemType.Other;
    public ItemRarity Rarity { get; set; } = ItemRarity.Common;

    /// <summary>Equipped/worn vs. just carried. Meaningful only when the item is on a character.</summary>
    public bool Equipped { get; set; }
}
