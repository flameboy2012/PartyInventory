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
