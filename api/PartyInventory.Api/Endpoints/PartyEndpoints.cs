using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Endpoints;

public static class PartyEndpoints
{
    // Unambiguous code alphabet: no 0/O/1/I/L to avoid confusion when sharing codes verbally.
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 6;

    public static IEndpointRouteBuilder MapPartyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/parties").WithTags("Parties");

        group.MapGet("/", ListParties)
             .Produces<List<PartySummary>>();
        group.MapPost("/", CreateParty)
             .Produces<PartyResponse>(StatusCodes.Status201Created)
             .ProducesValidationProblem();
        group.MapPost("/join", JoinParty)
             .Produces<PartyResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapGet("/{id:guid}", GetParty)
             .Produces<PartyResponse>()
             .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> ListParties(AppDbContext db)
    {
        var parties = await db.Parties
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PartySummary(p.Id, p.Name, p.CreatedAt, p.Characters.Count))
            .ToListAsync();

        return Results.Ok(parties);
    }

    private static async Task<IResult> CreateParty(CreatePartyRequest request, AppDbContext db)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["name"] = ["Party name is required."]
            });
        }

        var code = await GenerateUniqueJoinCodeAsync(db);

        var party = new Party
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            JoinCode = code,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Parties.Add(party);
        await db.SaveChangesAsync();

        return Results.Created($"/api/parties/{party.Id}", ToResponse(party));
    }

    private static async Task<IResult> JoinParty(JoinPartyRequest request, AppDbContext db)
    {
        if (string.IsNullOrWhiteSpace(request.JoinCode))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["joinCode"] = ["A join code is required."]
            });
        }

        var code = request.JoinCode.Trim().ToUpperInvariant();

        var party = await db.Parties
            .Include(p => p.Characters)
            .FirstOrDefaultAsync(p => p.JoinCode == code);

        return party is null
            ? Results.NotFound(new { message = "No party found for that code." })
            : Results.Ok(ToResponse(party));
    }

    private static async Task<IResult> GetParty(Guid id, AppDbContext db)
    {
        var party = await db.Parties
            .Include(p => p.Characters)
            .FirstOrDefaultAsync(p => p.Id == id);

        return party is null ? Results.NotFound() : Results.Ok(ToResponse(party));
    }

    private static async Task<string> GenerateUniqueJoinCodeAsync(AppDbContext db)
    {
        // Retry on the rare collision; the unique index is the real guarantee.
        string code;
        do
        {
            code = GenerateJoinCode();
        } while (await db.Parties.AnyAsync(p => p.JoinCode == code));

        return code;
    }

    private static string GenerateJoinCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(CodeLength);
        var chars = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
        {
            chars[i] = CodeAlphabet[bytes[i] % CodeAlphabet.Length];
        }

        return new string(chars);
    }

    private static PartyResponse ToResponse(Party party) => new(
        party.Id,
        party.Name,
        party.JoinCode,
        party.CreatedAt,
        new CoinPurseDto(
            party.Coins.Copper,
            party.Coins.Silver,
            party.Coins.Electrum,
            party.Coins.Gold,
            party.Coins.Platinum),
        party.Characters
            .OrderBy(c => c.Name)
            .Select(c => new CharacterSummary(c.Id, c.Name, c.Class, c.Level))
            .ToList());
}
