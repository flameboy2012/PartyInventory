using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Audit;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Endpoints;

public static class AuditEndpoints
{
    /// <summary>Page size when the caller doesn't ask for one.</summary>
    private const int DefaultTake = 50;

    /// <summary>An abuse guard, not the page size: the client chooses how much it wants.</summary>
    private const int MaxTake = 200;

    public static IEndpointRouteBuilder MapAuditEndpoints(this IEndpointRouteBuilder app)
    {
        // Read-only by design: there is no route that edits or deletes a recorded entry.
        app.MapGet("/api/parties/{partyId:guid}/audit", GetAuditFeed)
           .WithTags("Audit")
           .Produces<AuditFeedResponse>()
           .ProducesValidationProblem()
           .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> GetAuditFeed(
        Guid partyId, AppDbContext db, int? take, string? before)
    {
        if (!await db.Parties.AnyAsync(p => p.Id == partyId))
        {
            return Results.NotFound();
        }

        var pageSize = Math.Clamp(take ?? DefaultTake, 1, MaxTake);
        var query = db.AuditEntries.Where(a => a.PartyId == partyId);

        if (before is not null)
        {
            if (!AuditCursor.TryParse(before, out var occurredAt, out var id))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["before"] = ["That isn't a cursor from this feed."]
                });
            }

            // Keyset, not offset: entries arriving at the head while a player reads must not shift
            // the window underneath them.
            query = query.Where(a =>
                a.OccurredAt < occurredAt || (a.OccurredAt == occurredAt && a.Id.CompareTo(id) < 0));
        }

        // One extra row tells us whether an older page exists, without a second count query.
        var page = await query
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)
            .Take(pageSize + 1)
            .ToListAsync();

        var hasOlder = page.Count > pageSize;
        if (hasOlder)
        {
            page.RemoveAt(page.Count - 1);
        }

        return Results.Ok(new AuditFeedResponse(
            page.Select(ToResponse).ToList(),
            hasOlder ? AuditCursor.From(page[^1]) : null));
    }

    private static AuditEntryResponse ToResponse(AuditEntry entry) => new(
        entry.Id,
        entry.OccurredAt,
        entry.ActorName,
        entry.Action,
        entry.SubjectId,
        entry.SubjectName,
        entry.Detail);
}
