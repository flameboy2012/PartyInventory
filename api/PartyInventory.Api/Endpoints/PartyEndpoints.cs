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
        group.MapPut("/{id:guid}/coins", UpdatePartyCoins)
             .Produces<PartyResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPost("/{id:guid}/coins/spend", SpendPartyCoins)
             .Produces<PartyResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPost("/{id:guid}/coins/transfer", TransferCoins)
             .Produces<TransferCoinsResponse>()
             .ProducesValidationProblem()
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

    private static async Task<IResult> UpdatePartyCoins(Guid id, CoinPurseDto request, AppDbContext db)
    {
        var errors = CoinUpdates.Validate(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var party = await db.Parties
            .Include(p => p.Characters)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (party is null)
        {
            return Results.NotFound();
        }

        CoinUpdates.Apply(party.Coins, request);
        await db.SaveChangesAsync();

        return Results.Ok(ToResponse(party));
    }

    private static async Task<IResult> SpendPartyCoins(Guid id, SpendCoinsRequest request, AppDbContext db)
    {
        var errors = CoinUpdates.ValidateSpend(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var party = await db.Parties
            .Include(p => p.Characters)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (party is null)
        {
            return Results.NotFound();
        }

        if (!CoinUpdates.TrySpend(party.Coins, request))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["spend"] = ["The stash doesn't have enough coins for that."]
            });
        }

        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(party));
    }

    private static async Task<IResult> TransferCoins(Guid id, TransferCoinsRequest request, AppDbContext db)
    {
        var errors = CoinUpdates.ValidateTransfer(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        if (request.FromCharacterId == request.ToCharacterId)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["toCharacterId"] = ["The source and destination must be different."]
            });
        }

        var party = await db.Parties
            .Include(p => p.Characters)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (party is null)
        {
            return Results.NotFound();
        }

        var source = ResolvePurse(party, request.FromCharacterId);
        if (source is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["fromCharacterId"] = ["Character not found in this party."]
            });
        }

        var destination = ResolvePurse(party, request.ToCharacterId);
        if (destination is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["toCharacterId"] = ["Character not found in this party."]
            });
        }

        var spend = new SpendCoinsRequest(
            request.Copper, request.Silver, request.Electrum, request.Gold, request.Platinum);
        if (!CoinUpdates.TrySpend(source, spend))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["coins"] = ["The source purse doesn't have enough coins for that."]
            });
        }

        CoinUpdates.Add(
            destination, request.Copper, request.Silver, request.Electrum, request.Gold, request.Platinum);
        await db.SaveChangesAsync();

        return Results.Ok(new TransferCoinsResponse(CoinUpdates.ToDto(source), CoinUpdates.ToDto(destination)));
    }

    private static CoinPurse? ResolvePurse(Party party, Guid? characterId) =>
        characterId is null
            ? party.Coins
            : party.Characters.FirstOrDefault(c => c.Id == characterId)?.Coins;

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
