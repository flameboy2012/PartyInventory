namespace PartyInventory.Api.Domain;

/// <summary>Broad category of an inventory item, used for sorting/filtering.</summary>
public enum ItemType
{
    Weapon,
    Armor,
    Potion,
    Scroll,
    Gear,
    Treasure,
    Other
}

/// <summary>D&D item rarity tiers.</summary>
public enum ItemRarity
{
    Common,
    Uncommon,
    Rare,
    VeryRare,
    Legendary,
    Artifact
}

/// <summary>
/// The kind of change an <see cref="AuditEntry"/> records. One value per mutating operation,
/// except that editing an item's holder and editing its details are separate kinds even though
/// both arrive on the same request.
/// </summary>
public enum AuditAction
{
    PartyCoinsSet,
    PartyCoinsSpent,
    CoinsTransferred,
    CharacterCreated,
    CharacterEdited,
    CharacterDeleted,
    CharacterCoinsSet,
    CharacterCoinsSpent,
    ItemAdded,
    ItemEdited,
    ItemMoved,
    ItemDeleted
}
