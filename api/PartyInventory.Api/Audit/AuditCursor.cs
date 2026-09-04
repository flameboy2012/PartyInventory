using System.Buffers.Text;
using System.Globalization;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Audit;

/// <summary>
/// The feed's keyset cursor: the <c>(OccurredAt, Id)</c> of the last entry a client has seen.
/// A timestamp alone would not do, because entries written by one request share a timestamp and
/// must not be split across a page boundary unpredictably.
/// </summary>
public static class AuditCursor
{
    /// <summary>The cursor pointing just past <paramref name="entry"/>.</summary>
    public static string From(AuditEntry entry) =>
        Base64Url.EncodeToString(
            System.Text.Encoding.UTF8.GetBytes(
                $"{entry.OccurredAt.UtcTicks.ToString(CultureInfo.InvariantCulture)}:{entry.Id:N}"));

    public static bool TryParse(string cursor, out DateTimeOffset occurredAt, out Guid id)
    {
        occurredAt = default;
        id = default;

        string decoded;
        try
        {
            decoded = System.Text.Encoding.UTF8.GetString(Base64Url.DecodeFromChars(cursor));
        }
        catch (FormatException)
        {
            return false;
        }

        var separator = decoded.IndexOf(':');
        if (separator < 0)
        {
            return false;
        }

        if (!long.TryParse(
                decoded[..separator], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks) ||
            ticks < 0 || ticks > DateTimeOffset.MaxValue.UtcTicks)
        {
            return false;
        }

        if (!Guid.TryParseExact(decoded[(separator + 1)..], "N", out id))
        {
            return false;
        }

        occurredAt = new DateTimeOffset(ticks, TimeSpan.Zero);
        return true;
    }
}
