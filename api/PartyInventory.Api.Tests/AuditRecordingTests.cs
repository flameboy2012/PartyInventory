using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using PartyInventory.Api.Audit;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Data;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Tests;

/// <summary>
/// Covers what each mutating handler records: one entry per applied change, describing the
/// player's intent, and nothing at all when the change is rejected.
/// </summary>
[Collection("api")]
public class AuditRecordingTests(ApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task AuditLog_AddsOneRowThatTheCallersSaveCommits()
    {
        var party = await CreatePartyAsync("Direct");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditLog>();

        audit.Record(party.Id, "Nori", AuditAction.ItemAdded, "Lantern", "Added Lantern");

        // Nothing is written until the caller saves.
        Assert.Empty(await ReadEntriesAsync(party.Id));

        await db.SaveChangesAsync();

        var entry = Assert.Single(await ReadEntriesAsync(party.Id));
        Assert.Equal("Nori", entry.ActorName);
        Assert.Equal(AuditAction.ItemAdded, entry.Action);
        Assert.Equal("Lantern", entry.SubjectName);
        Assert.Equal("Added Lantern", entry.Detail);
    }

    [Fact]
    public async Task SetPartyCoins_RecordsTheAmountItWasSetTo()
    {
        var party = await CreatePartyAsync("Stash Set");

        await _client.PutAsJsonAsync($"/api/parties/{party.Id}/coins", new { gold = 12, silver = 3 });

        var entry = Assert.Single(await ReadEntriesAsync(party.Id));
        Assert.Equal(AuditAction.PartyCoinsSet, entry.Action);
        Assert.Equal(ApiFactory.DefaultActorName, entry.ActorName);
        Assert.Contains("12 gp, 3 sp", entry.Detail);
    }

    [Fact]
    public async Task SpendPartyCoins_RecordsTheAmountSpentNotTheResultingBalances()
    {
        var party = await CreatePartyAsync("Purchase");
        await SetCoinsAsync($"/api/parties/{party.Id}/coins", new { gold = 5 });

        // Covering 3 gp from a 5 gp purse leaves 2 gp; nothing breaks here, but the point stands:
        // the entry describes the spend, never the balances it produced.
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/coins/spend",
            new { gold = 3 });
        response.EnsureSuccessStatusCode();

        var entry = (await ReadEntriesAsync(party.Id)).Last();
        Assert.Equal(AuditAction.PartyCoinsSpent, entry.Action);
        Assert.Contains("Spent 3 gp", entry.Detail);
        Assert.DoesNotContain("2 gp", entry.Detail);
    }

    [Fact]
    public async Task SpendPartyCoins_ThatBreaksADenomination_StillRecordsOnlyTheSpend()
    {
        var party = await CreatePartyAsync("Breaking");
        await SetCoinsAsync($"/api/parties/{party.Id}/coins", new { gold = 5 });

        // 5 sp out of a purse of only gold: the handler breaks 1 gp down to cover it.
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/coins/spend",
            new { silver = 5 });
        response.EnsureSuccessStatusCode();

        var entry = (await ReadEntriesAsync(party.Id)).Last();
        Assert.Contains("Spent 5 sp", entry.Detail);
        // The resulting 4 gp + 1 ep breakdown is exactly what must not appear.
        Assert.DoesNotContain("ep", entry.Detail);
    }

    [Fact]
    public async Task TransferCoins_RecordsOneEventNamingBothEnds()
    {
        var party = await CreatePartyAsync("Handover");
        var character = await CreateCharacterAsync(party.Id, "Thorin");
        await SetCoinsAsync($"/api/parties/{party.Id}/coins", new { gold = 10 });

        var before = (await ReadEntriesAsync(party.Id)).Count;
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/coins/transfer",
            new { fromCharacterId = (Guid?)null, toCharacterId = character.Id, gold = 5 });
        response.EnsureSuccessStatusCode();

        var entries = await ReadEntriesAsync(party.Id);
        Assert.Equal(before + 1, entries.Count); // one movement, one event
        var entry = entries.Last();
        Assert.Equal(AuditAction.CoinsTransferred, entry.Action);
        Assert.Contains("5 gp", entry.Detail);
        Assert.Contains(AuditText.Stash, entry.Detail);
        Assert.Contains("Thorin", entry.Detail);
    }

    [Fact]
    public async Task CharacterHandlers_EachRecordOneEventNamingTheCharacterAtTheTime()
    {
        var party = await CreatePartyAsync("Roster");

        var character = await CreateCharacterAsync(party.Id, "Balin");
        var created = Assert.Single(await ReadEntriesAsync(party.Id));
        Assert.Equal(AuditAction.CharacterCreated, created.Action);
        Assert.Equal("Balin", created.SubjectName);
        Assert.Equal(character.Id, created.SubjectId);

        await ExpectOneMoreEntryAsync(party.Id, AuditAction.CharacterCoinsSet, () =>
            _client.PutAsJsonAsync(
                $"/api/parties/{party.Id}/characters/{character.Id}/coins", new { gold = 6 }));

        await ExpectOneMoreEntryAsync(party.Id, AuditAction.CharacterCoinsSpent, () =>
            _client.PostAsJsonAsync(
                $"/api/parties/{party.Id}/characters/{character.Id}/coins/spend", new { gold = 2 }));

        var renamed = await ExpectOneMoreEntryAsync(party.Id, AuditAction.CharacterEdited, () =>
            _client.PutAsJsonAsync(
                $"/api/parties/{party.Id}/characters/{character.Id}",
                new { name = "Balin Fundinson", level = 3 }));
        // The subject keeps the name it had when the change happened.
        Assert.Equal("Balin", renamed.SubjectName);
        Assert.Contains("Renamed Balin to Balin Fundinson", renamed.Detail);

        var deleted = await ExpectOneMoreEntryAsync(party.Id, AuditAction.CharacterDeleted, () =>
            _client.DeleteAsync($"/api/parties/{party.Id}/characters/{character.Id}"));
        Assert.Equal("Balin Fundinson", deleted.SubjectName);

        // The earlier entries still name the character as it was, though the row is gone.
        var entries = await ReadEntriesAsync(party.Id);
        Assert.Equal("Balin", entries[0].SubjectName);
    }

    [Fact]
    public async Task ItemCreateAndDelete_CarryTheItemNameAsText()
    {
        var party = await CreatePartyAsync("Loot");

        var item = await CreateItemAsync(party.Id, "Longsword");
        var added = Assert.Single(await ReadEntriesAsync(party.Id));
        Assert.Equal(AuditAction.ItemAdded, added.Action);
        Assert.Equal("Longsword", added.SubjectName);
        Assert.Contains("Added Longsword", added.Detail);

        var removed = await ExpectOneMoreEntryAsync(party.Id, AuditAction.ItemDeleted, () =>
            _client.DeleteAsync($"/api/parties/{party.Id}/items/{item.Id}"));
        Assert.Equal("Longsword", removed.SubjectName);
        Assert.Contains("Removed Longsword", removed.Detail);

        // The item is gone, but the history still names it.
        Assert.Null(await factory.QueryAsync(db =>
            db.Items.FirstOrDefaultAsync(i => i.Id == item.Id)));
        Assert.All(
            await ReadEntriesAsync(party.Id),
            entry => Assert.Equal("Longsword", entry.SubjectName));
    }

    [Fact]
    public async Task UpdateItem_MoveOnly_RecordsAMoveNamingBothHolders()
    {
        var party = await CreatePartyAsync("Handoff");
        var character = await CreateCharacterAsync(party.Id, "Gimli");
        var item = await CreateItemAsync(party.Id, "Axe");

        var before = (await ReadEntriesAsync(party.Id)).Count;
        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/items/{item.Id}",
            new { name = "Axe", quantity = 1, characterId = character.Id });
        response.EnsureSuccessStatusCode();

        var entries = await ReadEntriesAsync(party.Id);
        Assert.Equal(before + 1, entries.Count);
        var moved = entries.Last();
        Assert.Equal(AuditAction.ItemMoved, moved.Action);
        Assert.Contains("Moved Axe", moved.Detail);
        Assert.Contains(AuditText.Stash, moved.Detail);
        Assert.Contains("Gimli", moved.Detail);
    }

    [Fact]
    public async Task UpdateItem_EditOnly_RecordsAnEditAndNoMove()
    {
        var party = await CreatePartyAsync("Correction");
        var item = await CreateItemAsync(party.Id, "Rope");

        var before = (await ReadEntriesAsync(party.Id)).Count;
        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/items/{item.Id}",
            new { name = "Rope", quantity = 3, characterId = (Guid?)null });
        response.EnsureSuccessStatusCode();

        var entries = await ReadEntriesAsync(party.Id);
        Assert.Equal(before + 1, entries.Count);
        var edited = entries.Last();
        Assert.Equal(AuditAction.ItemEdited, edited.Action);
        Assert.Contains("quantity", edited.Detail);
        Assert.DoesNotContain(entries, e => e.Action == AuditAction.ItemMoved);
    }

    [Fact]
    public async Task UpdateItem_MovedAndEditedAtOnce_RecordsBoth()
    {
        var party = await CreatePartyAsync("Both");
        var character = await CreateCharacterAsync(party.Id, "Legolas");
        var item = await CreateItemAsync(party.Id, "Bow");

        var before = (await ReadEntriesAsync(party.Id)).Count;
        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/items/{item.Id}",
            new { name = "Elven Bow", quantity = 1, characterId = character.Id });
        response.EnsureSuccessStatusCode();

        var entries = await ReadEntriesAsync(party.Id);
        Assert.Equal(before + 2, entries.Count);
        Assert.Contains(entries, e => e.Action == AuditAction.ItemMoved);
        Assert.Contains(entries, e => e.Action == AuditAction.ItemEdited);
    }

    [Fact]
    public async Task RejectedWrites_RecordNothing()
    {
        var party = await CreatePartyAsync("Refused");
        var character = await CreateCharacterAsync(party.Id, "Sam");
        var before = (await ReadEntriesAsync(party.Id)).Count;

        // Validation failures.
        var negative = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/coins", new { gold = -1 });
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);

        var tooPoor = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{character.Id}/coins/spend", new { platinum = 99 });
        Assert.Equal(HttpStatusCode.BadRequest, tooPoor.StatusCode);

        var nameless = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/items", new { name = "  ", quantity = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, nameless.StatusCode);

        // Unknown ids.
        var noSuchItem = await _client.DeleteAsync($"/api/parties/{party.Id}/items/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, noSuchItem.StatusCode);

        var noSuchCharacter = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{Guid.NewGuid()}", new { name = "Ghost" });
        Assert.Equal(HttpStatusCode.NotFound, noSuchCharacter.StatusCode);

        Assert.Equal(before, (await ReadEntriesAsync(party.Id)).Count);
    }

    [Fact]
    public async Task EveryAuditEmittingRoute_SavesItsEventInTheSameUnitOfWorkAsTheChange()
    {
        var counter = new SaveCounter();
        using var counted = factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
                services.AddSingleton<IInterceptor>(new SaveCountingInterceptor(counter))));
        var client = counted.CreateClient();

        var party = await CreatePartyAsync("Unit Of Work", client);
        var character = await CreateCharacterAsync(party.Id, "Merry", client);
        var item = await CreateItemAsync(party.Id, "Torch", client);

        foreach (var (name, send) in ActorNameTests.AuditEmittingRoutes(
                     client, party.Id, character.Id, item.Id))
        {
            var entriesBefore = (await ReadEntriesAsync(party.Id)).Count;
            counter.Reset();

            var response = await send();
            Assert.True(
                response.IsSuccessStatusCode,
                $"{name} answered {(int)response.StatusCode}; expected success.");

            var entriesAfter = (await ReadEntriesAsync(party.Id)).Count;
            Assert.True(
                entriesAfter == entriesBefore + 1,
                $"{name} left {entriesAfter - entriesBefore} audit entries; expected exactly 1.");
            Assert.True(
                counter.Saves == 1,
                $"{name} saved {counter.Saves} times; the audit entry must ride the handler's own save.");
        }
    }

    private async Task<AuditEntry> ExpectOneMoreEntryAsync(
        Guid partyId, AuditAction expected, Func<Task<HttpResponseMessage>> send)
    {
        var before = (await ReadEntriesAsync(partyId)).Count;

        var response = await send();
        response.EnsureSuccessStatusCode();

        var entries = await ReadEntriesAsync(partyId);
        Assert.Equal(before + 1, entries.Count);

        var entry = entries.Last();
        Assert.Equal(expected, entry.Action);
        return entry;
    }

    /// <summary>A party's entries oldest first, so tests can talk about "the latest".</summary>
    private Task<List<AuditEntry>> ReadEntriesAsync(Guid partyId) =>
        factory.QueryAsync(db => db.AuditEntries
            .Where(a => a.PartyId == partyId)
            .OrderBy(a => a.OccurredAt).ThenBy(a => a.Id)
            .ToListAsync());

    private async Task SetCoinsAsync(string url, object coins)
    {
        var response = await _client.PutAsJsonAsync(url, coins);
        response.EnsureSuccessStatusCode();
    }

    private async Task<PartyResponse> CreatePartyAsync(string name, HttpClient? client = null)
    {
        var response = await (client ?? _client).PostAsJsonAsync("/api/parties", new { name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PartyResponse>())!;
    }

    private async Task<CharacterResponse> CreateCharacterAsync(
        Guid partyId, string name, HttpClient? client = null)
    {
        var response = await (client ?? _client).PostAsJsonAsync(
            $"/api/parties/{partyId}/characters", new { name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CharacterResponse>())!;
    }

    private async Task<ItemResponse> CreateItemAsync(
        Guid partyId, string name, HttpClient? client = null)
    {
        var response = await (client ?? _client).PostAsJsonAsync(
            $"/api/parties/{partyId}/items", new { name, quantity = 1 });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ItemResponse>(Json))!;
    }

    private sealed class SaveCounter
    {
        private int _saves;

        public int Saves => Volatile.Read(ref _saves);

        public void Reset() => Interlocked.Exchange(ref _saves, 0);

        public void Increment() => Interlocked.Increment(ref _saves);
    }

    /// <summary>Counts SaveChanges calls, to prove a handler commits its change and its entry once.</summary>
    private sealed class SaveCountingInterceptor(SaveCounter counter) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            counter.Increment();
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
