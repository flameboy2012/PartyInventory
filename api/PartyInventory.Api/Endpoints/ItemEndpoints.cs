using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;
using PartyInventory.Api.Realtime;

namespace PartyInventory.Api.Endpoints;

public static class ItemEndpoints
{
    public static IEndpointRouteBuilder MapItemEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/parties/{partyId:guid}/items").WithTags("Items");

        group.MapGet("/", ListItems)
             .Produces<List<ItemResponse>>()
             .Produces(StatusCodes.Status404NotFound);
        group.MapGet("/{itemId:guid}", GetItem)
             .Produces<ItemResponse>()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPost("/", CreateItem)
             .Produces<ItemResponse>(StatusCodes.Status201Created)
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapPut("/{itemId:guid}", UpdateItem)
             .Produces<ItemResponse>()
             .ProducesValidationProblem()
             .Produces(StatusCodes.Status404NotFound);
        group.MapDelete("/{itemId:guid}", DeleteItem)
             .Produces(StatusCodes.Status204NoContent)
             .Produces(StatusCodes.Status404NotFound);

        // Convenience read view of the party stash (shared coins + unheld items).
        app.MapGet("/api/parties/{partyId:guid}/stash", GetStash)
           .WithTags("Items")
           .Produces<StashResponse>()
           .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> ListItems(Guid partyId, AppDbContext db, Guid? characterId, string? location)
    {
        if (!await db.Parties.AnyAsync(p => p.Id == partyId))
        {
            return Results.NotFound(new { message = "Party not found." });
        }

        var query = db.Items.Where(i => i.PartyId == partyId);

        if (string.Equals(location, "stash", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(i => i.CharacterId == null);
        }
        else if (characterId is not null)
        {
            query = query.Where(i => i.CharacterId == characterId);
        }

        var items = await query.OrderBy(i => i.Name).ToListAsync();
        return Results.Ok(items.Select(ToResponse));
    }

    private static async Task<IResult> GetItem(Guid partyId, Guid itemId, AppDbContext db)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.PartyId == partyId);
        return item is null ? Results.NotFound() : Results.Ok(ToResponse(item));
    }

    private static async Task<IResult> CreateItem(
        Guid partyId, CreateItemRequest request, AppDbContext db, IPartyNotifier notifier)
    {
        var errors = Validate(request.Name, request.Quantity, request.ValueGp, request.Weight);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        if (!await db.Parties.AnyAsync(p => p.Id == partyId))
        {
            return Results.NotFound(new { message = "Party not found." });
        }

        if (!await CharacterBelongsToPartyAsync(db, partyId, request.CharacterId, errors))
        {
            return Results.ValidationProblem(errors);
        }

        var item = new Item
        {
            Id = Guid.NewGuid(),
            PartyId = partyId,
            CharacterId = request.CharacterId,
            Name = request.Name.Trim(),
            Description = Normalize(request.Description),
            Quantity = request.Quantity,
            ValueGp = request.ValueGp,
            Weight = request.Weight,
            Type = request.Type,
            Rarity = request.Rarity,
            Equipped = request.Equipped
        };

        db.Items.Add(item);
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Created($"/api/parties/{partyId}/items/{item.Id}", ToResponse(item));
    }

    private static async Task<IResult> UpdateItem(
        Guid partyId, Guid itemId, UpdateItemRequest request, AppDbContext db, IPartyNotifier notifier)
    {
        var errors = Validate(request.Name, request.Quantity, request.ValueGp, request.Weight);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.PartyId == partyId);
        if (item is null)
        {
            return Results.NotFound();
        }

        if (!await CharacterBelongsToPartyAsync(db, partyId, request.CharacterId, errors))
        {
            return Results.ValidationProblem(errors);
        }

        item.Name = request.Name.Trim();
        item.Description = Normalize(request.Description);
        item.Quantity = request.Quantity;
        item.ValueGp = request.ValueGp;
        item.Weight = request.Weight;
        item.Type = request.Type;
        item.Rarity = request.Rarity;
        item.Equipped = request.Equipped;
        item.CharacterId = request.CharacterId; // move (null = stash)
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Ok(ToResponse(item));
    }

    private static async Task<IResult> DeleteItem(
        Guid partyId, Guid itemId, AppDbContext db, IPartyNotifier notifier)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.PartyId == partyId);
        if (item is null)
        {
            return Results.NotFound();
        }

        db.Items.Remove(item);
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);
        return Results.NoContent();
    }

    private static async Task<IResult> GetStash(Guid partyId, AppDbContext db)
    {
        var party = await db.Parties.FirstOrDefaultAsync(p => p.Id == partyId);
        if (party is null)
        {
            return Results.NotFound();
        }

        var items = await db.Items
            .Where(i => i.PartyId == partyId && i.CharacterId == null)
            .OrderBy(i => i.Name)
            .ToListAsync();

        var coins = new CoinPurseDto(
            party.Coins.Copper,
            party.Coins.Silver,
            party.Coins.Electrum,
            party.Coins.Gold,
            party.Coins.Platinum);

        return Results.Ok(new StashResponse(coins, items.Select(ToResponse).ToList()));
    }

    private static async Task<bool> CharacterBelongsToPartyAsync(
        AppDbContext db, Guid partyId, Guid? characterId, Dictionary<string, string[]> errors)
    {
        if (characterId is null)
        {
            return true; // stash
        }

        var belongs = await db.Characters.AnyAsync(c => c.Id == characterId && c.PartyId == partyId);
        if (!belongs)
        {
            errors["characterId"] = ["Character not found in this party."];
        }

        return belongs;
    }

    private static Dictionary<string, string[]> Validate(string? name, int quantity, decimal valueGp, decimal weight)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(name))
        {
            errors["name"] = ["Item name is required."];
        }

        if (quantity < 1)
        {
            errors["quantity"] = ["Quantity must be 1 or greater."];
        }

        if (valueGp < 0)
        {
            errors["valueGp"] = ["Value cannot be negative."];
        }

        if (weight < 0)
        {
            errors["weight"] = ["Weight cannot be negative."];
        }

        return errors;
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ItemResponse ToResponse(Item i) => new(
        i.Id,
        i.PartyId,
        i.CharacterId,
        i.Name,
        i.Description,
        i.Quantity,
        i.ValueGp,
        i.Weight,
        i.Type,
        i.Rarity,
        i.Equipped);
}
