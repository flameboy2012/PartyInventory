using System.Net;
using System.Net.Http.Json;
using PartyInventory.Api.Contracts;

namespace PartyInventory.Api.Tests;

[Collection("api")]
public class CharacterEndpointsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CreateCharacter_ReturnsCreated()
    {
        var party = await CreatePartyAsync("Char Party");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/characters",
            new { name = "Aragorn", @class = "Ranger", level = 5 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var character = await response.Content.ReadFromJsonAsync<CharacterResponse>();
        Assert.NotNull(character);
        Assert.Equal("Aragorn", character!.Name);
        Assert.Equal("Ranger", character.Class);
        Assert.Equal(5, character.Level);
        Assert.Equal(party.Id, character.PartyId);
        Assert.NotEqual(Guid.Empty, character.Id);
    }

    [Fact]
    public async Task CreateCharacter_ForUnknownParty_ReturnsNotFound()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{Guid.NewGuid()}/characters",
            new { name = "Ghost" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateCharacter_WithEmptyName_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Validation Party");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/characters",
            new { name = "   " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateCharacter_WithInvalidLevel_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Level Party");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/characters",
            new { name = "Lowbie", level = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ListCharacters_ReturnsOnlyThatPartysCharacters()
    {
        var party = await CreatePartyAsync("Roster Party");
        await CreateCharacterAsync(party.Id, "Gimli");
        await CreateCharacterAsync(party.Id, "Legolas");

        var response = await _client.GetAsync($"/api/parties/{party.Id}/characters");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var characters = await response.Content.ReadFromJsonAsync<List<CharacterResponse>>();
        Assert.Equal(2, characters!.Count);
        Assert.Contains(characters, c => c.Name == "Gimli");
        Assert.Contains(characters, c => c.Name == "Legolas");
    }

    [Fact]
    public async Task ListCharacters_ForUnknownParty_ReturnsNotFound()
    {
        var response = await _client.GetAsync($"/api/parties/{Guid.NewGuid()}/characters");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCharacter_ReturnsCharacter()
    {
        var party = await CreatePartyAsync("Get Party");
        var created = await CreateCharacterAsync(party.Id, "Frodo");

        var fetched = await _client.GetFromJsonAsync<CharacterResponse>(
            $"/api/parties/{party.Id}/characters/{created.Id}");

        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("Frodo", fetched.Name);
    }

    [Fact]
    public async Task GetCharacter_WithUnknownId_ReturnsNotFound()
    {
        var party = await CreatePartyAsync("Get Missing Party");

        var response = await _client.GetAsync($"/api/parties/{party.Id}/characters/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCharacter_ChangesFields()
    {
        var party = await CreatePartyAsync("Update Party");
        var created = await CreateCharacterAsync(party.Id, "Sam");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{created.Id}",
            new { name = "Samwise", @class = "Gardener", level = 3 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<CharacterResponse>();
        Assert.Equal("Samwise", updated!.Name);
        Assert.Equal("Gardener", updated.Class);
        Assert.Equal(3, updated.Level);
    }

    [Fact]
    public async Task DeleteCharacter_RemovesCharacter()
    {
        var party = await CreatePartyAsync("Delete Party");
        var created = await CreateCharacterAsync(party.Id, "Boromir");

        var delete = await _client.DeleteAsync($"/api/parties/{party.Id}/characters/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var get = await _client.GetAsync($"/api/parties/{party.Id}/characters/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task CreatedCharacter_AppearsInPartyAndIncrementsCount()
    {
        var party = await CreatePartyAsync("Count Party");
        await CreateCharacterAsync(party.Id, "Merry");

        var partyResponse = await _client.GetFromJsonAsync<PartyResponse>($"/api/parties/{party.Id}");
        Assert.Contains(partyResponse!.Characters, c => c.Name == "Merry");

        var summaries = await _client.GetFromJsonAsync<List<PartySummary>>("/api/parties");
        var summary = Assert.Single(summaries!, p => p.Id == party.Id);
        Assert.Equal(1, summary.CharacterCount);
    }

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
}
