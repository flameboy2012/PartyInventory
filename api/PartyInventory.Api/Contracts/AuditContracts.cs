using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Contracts;

/// <summary>One recorded change, as the feed presents it.</summary>
public record AuditEntryResponse(
    Guid Id,
    DateTimeOffset OccurredAt,
    string ActorName,
    AuditAction Action,
    Guid? SubjectId,
    string SubjectName,
    string Detail);

/// <summary>
/// A page of a party's history, newest first. <see cref="NextCursor"/> is the value to pass as
/// <c>before</c> for the next page of older entries, or null when the feed has reached the end.
/// </summary>
public record AuditFeedResponse(IReadOnlyList<AuditEntryResponse> Entries, string? NextCursor);
