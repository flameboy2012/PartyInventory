namespace PartyInventory.Api.Contracts;

/// <summary>Request to add a character to a party.</summary>
public record CreateCharacterRequest(string Name, string? Class, int? Level);

/// <summary>Request to update a character's details.</summary>
public record UpdateCharacterRequest(string Name, string? Class, int? Level);

/// <summary>Full character details returned to clients.</summary>
public record CharacterResponse(
    Guid Id,
    Guid PartyId,
    string Name,
    string? Class,
    int? Level,
    CoinPurseDto Coins);
