using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Contracts;

/// <summary>Request to create an item. A null <see cref="CharacterId"/> places it in the party stash.</summary>
public record CreateItemRequest(
    string Name,
    string? Description,
    int Quantity,
    decimal ValueGp,
    decimal Weight,
    ItemType Type,
    ItemRarity Rarity,
    bool Equipped,
    Guid? CharacterId);

/// <summary>Request to update an item. Changing <see cref="CharacterId"/> moves it (null = stash).</summary>
public record UpdateItemRequest(
    string Name,
    string? Description,
    int Quantity,
    decimal ValueGp,
    decimal Weight,
    ItemType Type,
    ItemRarity Rarity,
    bool Equipped,
    Guid? CharacterId);

/// <summary>Item details returned to clients. <see cref="CharacterId"/> null means the party stash.</summary>
public record ItemResponse(
    Guid Id,
    Guid PartyId,
    Guid? CharacterId,
    string Name,
    string? Description,
    int Quantity,
    decimal ValueGp,
    decimal Weight,
    ItemType Type,
    ItemRarity Rarity,
    bool Equipped);

/// <summary>The party stash: shared coins plus the items nobody is holding.</summary>
public record StashResponse(CoinPurseDto Coins, IReadOnlyList<ItemResponse> Items);
