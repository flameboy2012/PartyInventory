using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Audit;

/// <summary>Records what a player did to a party's data.</summary>
public interface IAuditLog
{
    /// <summary>
    /// Adds an entry to the current unit of work. It is deliberately not saved here: the calling
    /// handler's own <c>SaveChangesAsync</c> commits the entry together with the change it
    /// describes, so neither can exist without the other.
    /// </summary>
    void Record(
        Guid partyId,
        string actorName,
        AuditAction action,
        string subjectName,
        string detail,
        Guid? subjectId = null);
}

public class AuditLog(AppDbContext db) : IAuditLog
{
    // Scoped, so every entry from one request shares a timestamp. Two events on the same request
    // (an item moved and edited at once) therefore sort together, which is why the feed's cursor
    // is (OccurredAt, Id) rather than a timestamp alone.
    private readonly DateTimeOffset _occurredAt = DateTimeOffset.UtcNow;

    public void Record(
        Guid partyId,
        string actorName,
        AuditAction action,
        string subjectName,
        string detail,
        Guid? subjectId = null) =>
        db.AuditEntries.Add(new AuditEntry
        {
            Id = Guid.NewGuid(),
            PartyId = partyId,
            OccurredAt = _occurredAt,
            ActorName = Cap(actorName, AuditEntry.ActorNameMaxLength),
            Action = action,
            SubjectId = subjectId,
            SubjectName = Cap(subjectName, AuditEntry.SubjectNameMaxLength),
            Detail = Cap(detail, AuditEntry.DetailMaxLength)
        });

    private static string Cap(string value, int maxLength) =>
        value.Length > maxLength ? value[..maxLength] : value;
}
