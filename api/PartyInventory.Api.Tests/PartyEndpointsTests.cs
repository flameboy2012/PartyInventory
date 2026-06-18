using System.Net;
using System.Net.Http.Json;
using PartyInventory.Api.Contracts;

namespace PartyInventory.Api.Tests;

[Collection("api")]
public class PartyEndpointsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CreateParty_ReturnsCreated_WithSixCharJoinCode()
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name = "The Brave Adventurers" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var party = await response.Content.ReadFromJsonAsync<PartyResponse>();
        Assert.NotNull(party);
        Assert.Equal("The Brave Adventurers", party!.Name);
        Assert.Equal(6, party.JoinCode.Length);
        Assert.NotEqual(Guid.Empty, party.Id);
        Assert.Empty(party.Characters);
    }

    [Fact]
    public async Task CreateParty_TrimsName()
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name = "  Spaced Out  " });
        var party = await response.Content.ReadFromJsonAsync<PartyResponse>();

        Assert.Equal("Spaced Out", party!.Name);
    }

    [Fact]
    public async Task CreateParty_WithEmptyName_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name = "   " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinParty_WithValidCode_ReturnsSameParty()
    {
        var created = await CreatePartyAsync("Join Target");

        var response = await _client.PostAsJsonAsync("/api/parties/join", new { joinCode = created.JoinCode });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var joined = await response.Content.ReadFromJsonAsync<PartyResponse>();
        Assert.Equal(created.Id, joined!.Id);
    }

    [Fact]
    public async Task JoinParty_IsCaseInsensitive()
    {
        var created = await CreatePartyAsync("Case Test");

        var response = await _client.PostAsJsonAsync(
            "/api/parties/join",
            new { joinCode = created.JoinCode.ToLowerInvariant() });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task JoinParty_WithUnknownCode_ReturnsNotFound()
    {
        var response = await _client.PostAsJsonAsync("/api/parties/join", new { joinCode = "ZZZZZZ" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task JoinParty_WithEmptyCode_ReturnsBadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/parties/join", new { joinCode = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetParty_ReturnsPersistedParty()
    {
        var created = await CreatePartyAsync("Persisted Party");

        var response = await _client.GetAsync($"/api/parties/{created.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var fetched = await response.Content.ReadFromJsonAsync<PartyResponse>();
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("Persisted Party", fetched.Name);
    }

    [Fact]
    public async Task GetParty_WithUnknownId_ReturnsNotFound()
    {
        var response = await _client.GetAsync($"/api/parties/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<PartyResponse> CreatePartyAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PartyResponse>())!;
    }
}
