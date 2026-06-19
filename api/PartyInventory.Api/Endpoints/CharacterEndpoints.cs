using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;
using PartyInventory.Api.Realtime;

namespace PartyInventory.Api.Endpoints;

public static class CharacterEndpoints
{
    public static IEndpointRouteBuilder MapCharacterEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/parties/{partyId:guid}/characters").WithTags("Characters");

        group.MapGet("/", ListCharacters)
             .Produces<List<CharacterResponse>>()
             .Produces(StatusCodes.Status404NotFound);
        group.MapGet("/{characterId:guid}", GetCharacter)
             .Produces<CharacterResponse>()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPost("/", CreateCharacter)
             .Produces<CharacterResponse>(StatusCodes.Status201Created)
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPut("/{characterId:guid}", UpdateCharacter)
             .Produces<CharacterResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapDelete("/{characterId:guid}", DeleteCharacter)
             .Produces(StatusCodes.Status204NoContent)
             .Produces(StatusCodes.Status404NotFound);
        group.MapPut("/{characterId:guid}/coins", UpdateCharacterCoins)
             .Produces<CharacterResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPost("/{characterId:guid}/coins/spend", SpendCharacterCoins)
             .Produces<CharacterResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> ListCharacters(Guid partyId, AppDbContext db)
    {
        if (!await db.Parties.AnyAsync(p => p.Id == partyId))
        {
            return Results.NotFound(new { message = "Party not found." });
        }

        var characters = await db.Characters
            .Where(c => c.PartyId == partyId)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Results.Ok(characters.Select(ToResponse));
    }

    private static async Task<IResult> GetCharacter(Guid partyId, Guid characterId, AppDbContext db)
    {
        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.Id == characterId && c.PartyId == partyId);

        return character is null ? Results.NotFound() : Results.Ok(ToResponse(character));
    }

    private static async Task<IResult> CreateCharacter(
        Guid partyId, CreateCharacterRequest request, AppDbContext db, IPartyNotifier notifier)
    {
        var errors = Validate(request.Name, request.Level);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        if (!await db.Parties.AnyAsync(p => p.Id == partyId))
        {
            return Results.NotFound(new { message = "Party not found." });
        }

        var character = new Character
        {
            Id = Guid.NewGuid(),
            PartyId = partyId,
            Name = request.Name.Trim(),
            Class = Normalize(request.Class),
            Level = request.Level
        };

        db.Characters.Add(character);
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Created(
            $"/api/parties/{partyId}/characters/{character.Id}",
            ToResponse(character));
    }

    private static async Task<IResult> UpdateCharacter(
        Guid partyId, Guid characterId, UpdateCharacterRequest request, AppDbContext db,
        IPartyNotifier notifier)
    {
        var errors = Validate(request.Name, request.Level);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.Id == characterId && c.PartyId == partyId);

        if (character is null)
        {
            return Results.NotFound();
        }

        character.Name = request.Name.Trim();
        character.Class = Normalize(request.Class);
        character.Level = request.Level;
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Ok(ToResponse(character));
    }

    private static async Task<IResult> UpdateCharacterCoins(
        Guid partyId, Guid characterId, CoinPurseDto request, AppDbContext db, IPartyNotifier notifier)
    {
        var errors = CoinUpdates.Validate(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.Id == characterId && c.PartyId == partyId);

        if (character is null)
        {
            return Results.NotFound();
        }

        CoinUpdates.Apply(character.Coins, request);
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Ok(ToResponse(character));
    }

    private static async Task<IResult> SpendCharacterCoins(
        Guid partyId, Guid characterId, SpendCoinsRequest request, AppDbContext db, IPartyNotifier notifier)
    {
        var errors = CoinUpdates.ValidateSpend(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.Id == characterId && c.PartyId == partyId);

        if (character is null)
        {
            return Results.NotFound();
        }

        if (!CoinUpdates.TrySpend(character.Coins, request))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["spend"] = ["This character doesn't have enough coins for that."]
            });
        }

        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);
        return Results.Ok(ToResponse(character));
    }

    private static async Task<IResult> DeleteCharacter(
        Guid partyId, Guid characterId, AppDbContext db, IPartyNotifier notifier)
    {
        var character = await db.Characters
            .FirstOrDefaultAsync(c => c.Id == characterId && c.PartyId == partyId);

        if (character is null)
        {
            return Results.NotFound();
        }

        // Items owned by this character fall back to the party stash (FK is ON DELETE SET NULL).
        db.Characters.Remove(character);
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.NoContent();
    }

    private static Dictionary<string, string[]> Validate(string? name, int? level)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(name))
        {
            errors["name"] = ["Character name is required."];
        }

        if (level is < 1)
        {
            errors["level"] = ["Level must be 1 or greater."];
        }

        return errors;
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static CharacterResponse ToResponse(Character c) => new(
        c.Id,
        c.PartyId,
        c.Name,
        c.Class,
        c.Level,
        new CoinPurseDto(c.Coins.Copper, c.Coins.Silver, c.Coins.Electrum, c.Coins.Gold, c.Coins.Platinum));
}
