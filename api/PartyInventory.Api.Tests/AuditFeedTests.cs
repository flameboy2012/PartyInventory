using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Tests;

/// <summary>Covers the party-wide feed: ordering, paging, scoping, and the empty and unknown cases.</summary>
[Collection("api")]
public class AuditFeedTests(ApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Feed_ReturnsEntriesNewestFirst()
    {
        var party = await CreatePartyAsync("Chronicle");
        await CreateItemAsync(party.Id, "First");
        await CreateItemAsync(party.Id, "Second");
        await CreateItemAsync(party.Id, "Third");

        var feed = await GetFeedAsync(party.Id);

        Assert.Equal(3, feed.Entries.Count);
        Assert.Equal("Third", feed.Entries[0].SubjectName);
        Assert.Equal("First", feed.Entries[2].SubjectName);
        Assert.Equal(ApiFactory.DefaultActorName, feed.Entries[0].ActorName);
        Assert.Equal(AuditAction.ItemAdded, feed.Entries[0].Action);
    }

    [Fact]
    public async Task Feed_DefaultsToFiftyEntries()
    {
        var party = await CreatePartyAsync("Fifty");
        await WriteEntriesAsync(party.Id, 60, DateTimeOffset.UtcNow);

        var feed = await GetFeedAsync(party.Id);

        Assert.Equal(50, feed.Entries.Count);
        Assert.NotNull(feed.NextCursor);
    }

    [Fact]
    public async Task Feed_ClampsTakeToTwoHundred()
    {
        var party = await CreatePartyAsync("Clamped");
        await WriteEntriesAsync(party.Id, 205, DateTimeOffset.UtcNow);

        var feed = await GetFeedAsync(party.Id, take: 1000);

        Assert.Equal(200, feed.Entries.Count);
    }

    [Fact]
    public async Task Feed_HonoursASmallerTake()
    {
        var party = await CreatePartyAsync("Small Page");
        await WriteEntriesAsync(party.Id, 5, DateTimeOffset.UtcNow);

        var feed = await GetFeedAsync(party.Id, take: 2);

        Assert.Equal(2, feed.Entries.Count);
        Assert.NotNull(feed.NextCursor);
    }

    [Fact]
    public async Task Feed_ForUnknownParty_ReturnsNotFound()
    {
        var response = await _client.GetAsync($"/api/parties/{Guid.NewGuid()}/audit");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Feed_ForAPartyWithNoHistory_ReturnsAnEmptyList()
    {
        var party = await CreatePartyAsync("Untouched");

        var feed = await GetFeedAsync(party.Id);

        Assert.Empty(feed.Entries);
        Assert.Null(feed.NextCursor);
    }

    [Fact]
    public async Task Feed_IsScopedToTheRequestedParty()
    {
        var mine = await CreatePartyAsync("Mine");
        var theirs = await CreatePartyAsync("Theirs");
        await CreateItemAsync(mine.Id, "My Lantern");
        await CreateItemAsync(theirs.Id, "Their Lantern");

        var feed = await GetFeedAsync(mine.Id);

        var entry = Assert.Single(feed.Entries);
        Assert.Equal("My Lantern", entry.SubjectName);
    }

    [Fact]
    public async Task Paging_OverEntriesSharingATimestamp_ReturnsEachExactlyOnce()
    {
        var party = await CreatePartyAsync("Same Instant");
        // Every entry written at one instant: the case a timestamp-only cursor cannot page.
        var written = await WriteEntriesAsync(party.Id, 25, DateTimeOffset.UtcNow);

        var seen = new List<Guid>();
        string? cursor = null;
        do
        {
            var page = await GetFeedAsync(party.Id, take: 4, before: cursor);
            seen.AddRange(page.Entries.Select(e => e.Id));
            cursor = page.NextCursor;
        } while (cursor is not null);

        Assert.Equal(written.Count, seen.Count); // no duplicates
        Assert.Equal(written.OrderBy(id => id), seen.OrderBy(id => id)); // no skips
        Assert.Equal(seen.Count, seen.Distinct().Count());
    }

    [Fact]
    public async Task Paging_AcrossDistinctTimestamps_WalksFromNewestToOldest()
    {
        var party = await CreatePartyAsync("Walk");
        var start = DateTimeOffset.UtcNow.AddMinutes(-30);
        for (var i = 0; i < 9; i++)
        {
            await WriteEntriesAsync(party.Id, 1, start.AddMinutes(i), $"Entry {i}");
        }

        var details = new List<string>();
        string? cursor = null;
        do
        {
            var page = await GetFeedAsync(party.Id, take: 3, before: cursor);
            details.AddRange(page.Entries.Select(e => e.Detail));
            cursor = page.NextCursor;
        } while (cursor is not null);

        Assert.Equal(9, details.Count);
        Assert.Equal("Entry 8", details[0]);
        Assert.Equal("Entry 0", details[^1]);
    }

    [Fact]
    public async Task Feed_WithAnUnreadableCursor_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Bad Cursor");

        var response = await _client.GetAsync($"/api/parties/{party.Id}/audit?before=not-a-cursor");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Feed_IsReadableWithoutAnActorName()
    {
        var party = await CreatePartyAsync("Open Read");
        await CreateItemAsync(party.Id, "Map");

        var anonymous = factory.CreateClientWithoutActorName();
        var response = await anonymous.GetAsync($"/api/parties/{party.Id}/audit");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// Writes entries straight to the database so a test can control the timestamps, including
    /// giving a whole batch the same one.
    /// </summary>
    private async Task<List<Guid>> WriteEntriesAsync(
        Guid partyId, int count, DateTimeOffset occurredAt, string? detail = null)
    {
        var entries = Enumerable.Range(0, count)
            .Select(i => new AuditEntry
            {
                Id = Guid.NewGuid(),
                PartyId = partyId,
                OccurredAt = occurredAt,
                ActorName = "Bulk",
                Action = AuditAction.ItemAdded,
                SubjectName = $"Thing {i}",
                Detail = detail ?? $"Added Thing {i}"
            })
            .ToList();

        await factory.QueryAsync(async db =>
        {
            db.AuditEntries.AddRange(entries);
            return await db.SaveChangesAsync();
        });

        return entries.Select(e => e.Id).ToList();
    }

    private async Task<AuditFeedResponse> GetFeedAsync(Guid partyId, int? take = null, string? before = null)
    {
        var query = new List<string>();
        if (take is not null) query.Add($"take={take}");
        if (before is not null) query.Add($"before={Uri.EscapeDataString(before)}");
        var url = $"/api/parties/{partyId}/audit" + (query.Count > 0 ? $"?{string.Join("&", query)}" : "");

        var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuditFeedResponse>(Json))!;
    }

    private async Task<PartyResponse> CreatePartyAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PartyResponse>())!;
    }

    private async Task CreateItemAsync(Guid partyId, string name)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{partyId}/items", new { name, quantity = 1 });
        response.EnsureSuccessStatusCode();
    }
}
