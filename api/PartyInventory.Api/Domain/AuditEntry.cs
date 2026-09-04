namespace PartyInventory.Api.Domain;

/// <summary>
/// An append-only record of one change to a party's data. Written in the same unit of work as
/// the change it describes, so an entry exists if and only if that change was applied.
/// </summary>
public class AuditEntry
{
    public const int ActorNameMaxLength = 60;
    public const int SubjectNameMaxLength = 160;
    public const int DetailMaxLength = 400;

    public Guid Id { get; set; }

    public Guid PartyId { get; set; }

    public DateTimeOffset OccurredAt { get; set; }

    /// <summary>Display name the player typed for this party. Self-declared; never proof of identity.</summary>
    public required string ActorName { get; set; }

    public AuditAction Action { get; set; }

    /// <summary>
    /// The character or item the change was about, or null for a party-level change. Deliberately
    /// not a foreign key: the history outlives the row it points at.
    /// </summary>
    public Guid? SubjectId { get; set; }

    /// <summary>
    /// The subject's name as it stood when the change happened, so the feed still reads after the
    /// subject is renamed or deleted.
    /// </summary>
    public required string SubjectName { get; set; }

    /// <summary>
    /// One-line summary of what the player did, rendered at write time by the handler that knows
    /// the intent. Carries neither the actor nor the timestamp — those are their own fields.
    /// </summary>
    public required string Detail { get; set; }
}
