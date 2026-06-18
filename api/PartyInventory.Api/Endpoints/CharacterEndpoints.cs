using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Endpoints;

public static class CharacterEndpoints
{
    public static IEndpointRouteBuilder MapCharacterEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/parties/{partyId:guid}/characters").WithTags("Characters");

        group.MapGet("/", ListCharacters);
        group.MapGet("/{characterId:guid}", GetCharacter);
        group.MapPost("/", CreateCharacter);
        group.MapPut("/{characterId:guid}", UpdateCharacter);
        group.MapDelete("/{characterId:guid}", DeleteCharacter);

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

    private static async Task<IResult> CreateCharacter(Guid partyId, CreateCharacterRequest request, AppDbContext db)
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

        return Results.Created(
            $"/api/parties/{partyId}/characters/{character.Id}",
            ToResponse(character));
    }

    private static async Task<IResult> UpdateCharacter(
        Guid partyId, Guid characterId, UpdateCharacterRequest request, AppDbContext db)
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

        return Results.Ok(ToResponse(character));
    }

    private static async Task<IResult> DeleteCharacter(Guid partyId, Guid characterId, AppDbContext db)
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
