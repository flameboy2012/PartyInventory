using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Audit;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;
using PartyInventory.Api.Realtime;

namespace PartyInventory.Api.Endpoints;

public static class ItemEndpoints
{
    public static IEndpointRouteBuilder MapItemEndpoints(this IEndpointRouteBuilder app)
    {
        // RequireActorName covers the whole group; it only challenges the mutating routes.
        var group = app.MapGroup("/api/parties/{partyId:guid}/items")
                       .WithTags("Items")
                       .RequireActorName();

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
        Guid partyId, CreateItemRequest request, AppDbContext db, IPartyNotifier notifier,
        IAuditLog audit, HttpContext http)
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
        audit.Record(
            partyId, http.Actor(), AuditAction.ItemAdded, item.Name,
            $"Added {Amount(item.Name, item.Quantity)} to {await HolderNameAsync(db, item.CharacterId)}",
            item.Id);
        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Created($"/api/parties/{partyId}/items/{item.Id}", ToResponse(item));
    }

    private static async Task<IResult> UpdateItem(
        Guid partyId, Guid itemId, UpdateItemRequest request, AppDbContext db, IPartyNotifier notifier,
        IAuditLog audit, HttpContext http)
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

        // This one route does double duty, so compare before and after to tell a move from an edit.
        var before = Snapshot(item);

        item.Name = request.Name.Trim();
        item.Description = Normalize(request.Description);
        item.Quantity = request.Quantity;
        item.ValueGp = request.ValueGp;
        item.Weight = request.Weight;
        item.Type = request.Type;
        item.Rarity = request.Rarity;
        item.Equipped = request.Equipped;
        item.CharacterId = request.CharacterId; // move (null = stash)

        var moved = item.CharacterId != before.CharacterId;
        if (moved)
        {
            audit.Record(
                partyId, http.Actor(), AuditAction.ItemMoved, before.Name,
                $"Moved {before.Name} from {await HolderNameAsync(db, before.CharacterId)} " +
                $"to {await HolderNameAsync(db, item.CharacterId)}",
                item.Id);
        }

        // An edit is recorded whenever the request wasn't purely a move, so a successful call is
        // never silent.
        if (!moved || Changes(before, item).Count > 0)
        {
            audit.Record(
                partyId, http.Actor(), AuditAction.ItemEdited, before.Name,
                EditDetail(before, item), item.Id);
        }

        await db.SaveChangesAsync();
        await notifier.PartyChanged(partyId);

        return Results.Ok(ToResponse(item));
    }

    private static async Task<IResult> DeleteItem(
        Guid partyId, Guid itemId, AppDbContext db, IPartyNotifier notifier, IAuditLog audit,
        HttpContext http)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == itemId && i.PartyId == partyId);
        if (item is null)
        {
            return Results.NotFound();
        }

        db.Items.Remove(item);
        // The name is copied into the entry as text, so the history still names the item afterwards.
        audit.Record(
            partyId, http.Actor(), AuditAction.ItemDeleted, item.Name,
            $"Removed {Amount(item.Name, item.Quantity)}", item.Id);
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

    /// <summary>An item's audited fields as they stood before an update.</summary>
    private sealed record ItemSnapshot(
        string Name,
        string? Description,
        int Quantity,
        decimal ValueGp,
        decimal Weight,
        ItemType Type,
        ItemRarity Rarity,
        bool Equipped,
        Guid? CharacterId);

    private static ItemSnapshot Snapshot(Item item) => new(
        item.Name, item.Description, item.Quantity, item.ValueGp, item.Weight,
        item.Type, item.Rarity, item.Equipped, item.CharacterId);

    /// <summary>Which of an item's own details changed. The holder is a move, not an edit.</summary>
    private static List<string> Changes(ItemSnapshot before, Item after)
    {
        var changed = new List<string>();

        void Check(bool differs, string field)
        {
            if (differs)
            {
                changed.Add(field);
            }
        }

        Check(after.Name != before.Name, "name");
        Check(after.Description != before.Description, "description");
        Check(after.Quantity != before.Quantity, "quantity");
        Check(after.ValueGp != before.ValueGp, "value");
        Check(after.Weight != before.Weight, "weight");
        Check(after.Type != before.Type, "type");
        Check(after.Rarity != before.Rarity, "rarity");
        Check(after.Equipped != before.Equipped, "equipped");

        return changed;
    }

    private static string EditDetail(ItemSnapshot before, Item after)
    {
        var changed = Changes(before, after);

        if (after.Name != before.Name && changed.Count == 1)
        {
            return $"Renamed {before.Name} to {after.Name}";
        }

        // Name the changed fields while the list is still short enough to read.
        return changed.Count is > 0 and <= 3
            ? $"Edited {before.Name} ({string.Join(", ", changed)})"
            : $"Edited {before.Name}";
    }

    /// <summary>An item with its count, e.g. <c>Torch ×3</c>, or just the name for a single one.</summary>
    private static string Amount(string name, int quantity) =>
        quantity > 1 ? $"{name} ×{quantity}" : name;

    /// <summary>Names an item's holder for a summary: a character, or the shared stash.</summary>
    private static async Task<string> HolderNameAsync(AppDbContext db, Guid? characterId) =>
        characterId is null
            ? AuditText.Stash
            : await db.Characters
                  .Where(c => c.Id == characterId)
                  .Select(c => c.Name)
                  .FirstOrDefaultAsync() ?? "an unknown character";

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
