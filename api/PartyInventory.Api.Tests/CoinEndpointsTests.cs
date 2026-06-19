using System.Net;
using System.Net.Http.Json;
using PartyInventory.Api.Contracts;

namespace PartyInventory.Api.Tests;

[Collection("api")]
public class CoinEndpointsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task UpdatePartyCoins_SetsStashCoins()
    {
        var party = await CreatePartyAsync("Treasury");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/coins",
            new { gold = 50, silver = 5 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<PartyResponse>();
        Assert.Equal(50, updated!.Coins.Gold);
        Assert.Equal(5, updated.Coins.Silver);
        Assert.Equal(0, updated.Coins.Copper);

        var fetched = await _client.GetFromJsonAsync<PartyResponse>($"/api/parties/{party.Id}");
        Assert.Equal(50, fetched!.Coins.Gold);
    }

    [Fact]
    public async Task UpdatePartyCoins_ForUnknownParty_ReturnsNotFound()
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{Guid.NewGuid()}/coins",
            new { gold = 10 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePartyCoins_WithNegativeAmount_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Overdrawn");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/coins",
            new { gold = -1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCharacterCoins_SetsCharacterCoins()
    {
        var party = await CreatePartyAsync("Coin Party");
        var character = await CreateCharacterAsync(party.Id, "Rich");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{character.Id}/coins",
            new { platinum = 2, gold = 10 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<CharacterResponse>();
        Assert.Equal(2, updated!.Coins.Platinum);
        Assert.Equal(10, updated.Coins.Gold);
    }

    [Fact]
    public async Task UpdateCharacterCoins_ForUnknownCharacter_ReturnsNotFound()
    {
        var party = await CreatePartyAsync("Missing Char");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{Guid.NewGuid()}/coins",
            new { gold = 10 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCharacterCoins_WithNegativeAmount_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Bad Coins");
        var character = await CreateCharacterAsync(party.Id, "Debtor");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{character.Id}/coins",
            new { copper = -5 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SpendPartyCoins_BreaksHigherDenominationToCover()
    {
        var party = await CreatePartyAsync("Spender");
        await SetCoinsAsync($"/api/parties/{party.Id}/coins", new { gold = 5 });

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/coins/spend",
            new { silver = 5 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<PartyResponse>();
        // 5 gp, spend 5 sp -> break 1 gp into 2 ep, spend 5 sp (= 1 ep) -> 4 gp + 1 ep
        Assert.Equal(4, updated!.Coins.Gold);
        Assert.Equal(1, updated.Coins.Electrum);
        Assert.Equal(0, updated.Coins.Silver);
    }

    [Fact]
    public async Task SpendPartyCoins_WithInsufficientTotal_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Poor");
        await SetCoinsAsync($"/api/parties/{party.Id}/coins", new { silver = 3 });

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/coins/spend",
            new { gold = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SpendCharacterCoins_BreaksPlatinum()
    {
        var party = await CreatePartyAsync("Spend Party");
        var character = await CreateCharacterAsync(party.Id, "Tariff");
        await SetCoinsAsync(
            $"/api/parties/{party.Id}/characters/{character.Id}/coins",
            new { platinum = 1 });

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/characters/{character.Id}/coins/spend",
            new { gold = 5 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<CharacterResponse>();
        // 1 pp -> 10 gp, spend 5 -> 5 gp left, 0 pp
        Assert.Equal(5, updated!.Coins.Gold);
        Assert.Equal(0, updated.Coins.Platinum);
    }

    [Fact]
    public async Task SpendPartyCoins_WithNegativeAmount_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Neg Spend");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/coins/spend",
            new { gold = -1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task SetCoinsAsync(string url, object coins)
    {
        var response = await _client.PutAsJsonAsync(url, coins);
        response.EnsureSuccessStatusCode();
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
