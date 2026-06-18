namespace PartyInventory.Api.Contracts;

/// <summary>Request to create a new party.</summary>
public record CreatePartyRequest(string Name);

/// <summary>Request to join an existing party by its share code.</summary>
public record JoinPartyRequest(string JoinCode);

/// <summary>Coins held by a party or character, in D&D denominations.</summary>
public record CoinPurseDto(int Copper, int Silver, int Electrum, int Gold, int Platinum);

/// <summary>Lightweight view of a character within a party.</summary>
public record CharacterSummary(Guid Id, string Name, string? Class, int? Level);

/// <summary>Party details returned to clients.</summary>
public record PartyResponse(
    Guid Id,
    string Name,
    string JoinCode,
    DateTimeOffset CreatedAt,
    CoinPurseDto Coins,
    IReadOnlyList<CharacterSummary> Characters);
