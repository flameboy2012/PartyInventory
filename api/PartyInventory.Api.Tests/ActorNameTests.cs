using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Endpoints;

namespace PartyInventory.Api.Tests;

/// <summary>
/// Covers the X-Actor-Name requirement: every audit-emitting write must name an actor, reads
/// never need one, and creating/joining a party stays exempt.
/// </summary>
[Collection("api")]
public class ActorNameTests(ApiFactory factory)
{
    // The API serializes enums as their string names.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly HttpClient _client = factory.CreateClient();
    private readonly HttpClient _anonymous = factory.CreateClientWithoutActorName();

    [Fact]
    public async Task Write_WithoutActorName_ReturnsValidationProblemNamingTheHeader()
    {
        var party = await CreatePartyAsync("No Name");

        var response = await _anonymous.PutAsJsonAsync(
            $"/api/parties/{party.Id}/coins",
            new { gold = 10 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemBody>();
        Assert.NotNull(problem);
        Assert.Contains(ActorName.HeaderName, problem!.Errors.Keys);

        // The change was not applied.
        var fetched = await _client.GetFromJsonAsync<PartyResponse>($"/api/parties/{party.Id}");
        Assert.Equal(0, fetched!.Coins.Gold);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Write_WithBlankActorName_IsRejected(string actor)
    {
        var party = await CreatePartyAsync("Blank Name");

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/parties/{party.Id}/coins")
        {
            Content = JsonContent.Create(new { gold = 10 })
        };
        request.Headers.TryAddWithoutValidation(ActorName.HeaderName, actor);

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var fetched = await _client.GetFromJsonAsync<PartyResponse>($"/api/parties/{party.Id}");
        Assert.Equal(0, fetched!.Coins.Gold);
    }

    [Fact]
    public async Task EveryAuditEmittingRoute_RejectsAWriteWithoutAnActorName()
    {
        var party = await CreatePartyAsync("Gauntlet");
        var character = await CreateCharacterAsync(party.Id, "Guard");
        var item = await CreateItemAsync(party.Id, "Torch");

        foreach (var (name, send) in AuditEmittingRoutes(_anonymous, party.Id, character.Id, item.Id))
        {
            var response = await send();
            Assert.True(
                response.StatusCode == HttpStatusCode.BadRequest,
                $"{name} answered {(int)response.StatusCode} without an actor name; expected 400.");
        }
    }

    [Fact]
    public async Task CreateAndJoinParty_StayExemptFromTheActorName()
    {
        var created = await _anonymous.PostAsJsonAsync("/api/parties", new { name = "Doorstep" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var party = (await created.Content.ReadFromJsonAsync<PartyResponse>())!;

        var joined = await _anonymous.PostAsJsonAsync(
            "/api/parties/join",
            new { joinCode = party.JoinCode });
        Assert.Equal(HttpStatusCode.OK, joined.StatusCode);

        var events = await factory.QueryAsync(db =>
            Task.FromResult(db.AuditEntries.Count(a => a.PartyId == party.Id)));
        Assert.Equal(0, events);
    }

    [Fact]
    public async Task Reads_SucceedWithoutAnActorName()
    {
        var party = await CreatePartyAsync("Readable");
        var character = await CreateCharacterAsync(party.Id, "Reader");
        var item = await CreateItemAsync(party.Id, "Book");

        string[] reads =
        [
            $"/api/parties/{party.Id}",
            $"/api/parties/{party.Id}/characters",
            $"/api/parties/{party.Id}/characters/{character.Id}",
            $"/api/parties/{party.Id}/items",
            $"/api/parties/{party.Id}/items/{item.Id}",
            $"/api/parties/{party.Id}/stash",
        ];

        foreach (var url in reads)
        {
            var response = await _anonymous.GetAsync(url);
            Assert.True(
                response.StatusCode == HttpStatusCode.OK,
                $"GET {url} answered {(int)response.StatusCode} without an actor name; expected 200.");
        }
    }

    [Fact]
    public async Task Write_WithPaddedActorName_IsAccepted()
    {
        var party = await CreatePartyAsync("Padded");

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/parties/{party.Id}/coins")
        {
            Content = JsonContent.Create(new { gold = 1 })
        };
        request.Headers.TryAddWithoutValidation(ActorName.HeaderName, "  Bilbo  ");

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// One entry per audit-emitting write route, as a name and a call that would succeed if the
    /// request carried an actor name. Shared by the rejection test and the audit guard test.
    /// </summary>
    internal static IEnumerable<(string Name, Func<Task<HttpResponseMessage>> Send)> AuditEmittingRoutes(
        HttpClient client, Guid partyId, Guid characterId, Guid itemId) =>
    [
        ("PUT party coins", () => client.PutAsJsonAsync(
            $"/api/parties/{partyId}/coins", new { gold = 5 })),
        ("POST party coins spend", () => client.PostAsJsonAsync(
            $"/api/parties/{partyId}/coins/spend", new { gold = 1 })),
        ("POST party coins transfer", () => client.PostAsJsonAsync(
            $"/api/parties/{partyId}/coins/transfer",
            new { fromCharacterId = (Guid?)null, toCharacterId = characterId, gold = 1 })),
        ("POST character", () => client.PostAsJsonAsync(
            $"/api/parties/{partyId}/characters", new { name = "Extra" })),
        ("PUT character", () => client.PutAsJsonAsync(
            $"/api/parties/{partyId}/characters/{characterId}", new { name = "Guard", level = 2 })),
        ("PUT character coins", () => client.PutAsJsonAsync(
            $"/api/parties/{partyId}/characters/{characterId}/coins", new { gold = 4 })),
        ("POST character coins spend", () => client.PostAsJsonAsync(
            $"/api/parties/{partyId}/characters/{characterId}/coins/spend", new { gold = 1 })),
        ("POST item", () => client.PostAsJsonAsync(
            $"/api/parties/{partyId}/items", new { name = "Rope", quantity = 1 })),
        ("PUT item", () => client.PutAsJsonAsync(
            $"/api/parties/{partyId}/items/{itemId}",
            new { name = "Torch", quantity = 2, characterId = (Guid?)null })),
        ("DELETE item", () => client.DeleteAsync($"/api/parties/{partyId}/items/{itemId}")),
        ("DELETE character", () => client.DeleteAsync(
            $"/api/parties/{partyId}/characters/{characterId}")),
    ];

    private async Task<PartyResponse> CreatePartyAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PartyResponse>())!;
    }

    private async Task<CharacterResponse> CreateCharacterAsync(Guid partyId, string name)
    {
        var response = await _client.PostAsJsonAsync($"/api/parties/{partyId}/characters", new { name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CharacterResponse>())!;
    }

    private async Task<ItemResponse> CreateItemAsync(Guid partyId, string name)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{partyId}/items",
            new { name, quantity = 1 });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ItemResponse>(Json))!;
    }

    private record ValidationProblemBody(Dictionary<string, string[]> Errors);
}
