using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PartyInventory.Api.Contracts;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Tests;

[Collection("api")]
public class ItemEndpointsTests(ApiFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CreateItem_InStash_ReturnsCreated_WithNullCharacter()
    {
        var party = await CreatePartyAsync("Loot Party");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/items",
            new { name = "Rope", quantity = 1, valueGp = 1.0, weight = 10.0, type = "Gear", rarity = "Common" },
            Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var item = await response.Content.ReadFromJsonAsync<ItemResponse>(Json);
        Assert.NotNull(item);
        Assert.Null(item!.CharacterId);
        Assert.Equal("Rope", item.Name);
        Assert.Equal(ItemType.Gear, item.Type);
        Assert.Equal(party.Id, item.PartyId);
    }

    [Fact]
    public async Task CreateItem_OnCharacter_SetsCharacterId()
    {
        var party = await CreatePartyAsync("Gear Party");
        var character = await CreateCharacterAsync(party.Id, "Thorin");

        var item = await CreateItemAsync(party.Id, "Axe", characterId: character.Id, type: "Weapon", rarity: "Rare");

        Assert.Equal(character.Id, item.CharacterId);
        Assert.Equal(ItemType.Weapon, item.Type);
        Assert.Equal(ItemRarity.Rare, item.Rarity);
    }

    [Fact]
    public async Task CreateItem_ForUnknownParty_ReturnsNotFound()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{Guid.NewGuid()}/items",
            new { name = "Ghost Item", quantity = 1, type = "Other", rarity = "Common" },
            Json);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateItem_WithCharacterFromAnotherParty_ReturnsBadRequest()
    {
        var partyA = await CreatePartyAsync("Party A");
        var partyB = await CreatePartyAsync("Party B");
        var bChar = await CreateCharacterAsync(partyB.Id, "Outsider");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{partyA.Id}/items",
            new { name = "Misfit", quantity = 1, type = "Gear", rarity = "Common", characterId = bChar.Id },
            Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateItem_WithEmptyName_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Bad Name Party");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/items",
            new { name = "  ", quantity = 1, type = "Gear", rarity = "Common" },
            Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateItem_WithZeroQuantity_ReturnsBadRequest()
    {
        var party = await CreatePartyAsync("Qty Party");

        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{party.Id}/items",
            new { name = "Nothing", quantity = 0, type = "Gear", rarity = "Common" },
            Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ListItems_FilterByLocationStash_ReturnsOnlyStashItems()
    {
        var party = await CreatePartyAsync("Filter Party");
        var character = await CreateCharacterAsync(party.Id, "Holder");
        await CreateItemAsync(party.Id, "StashPotion");
        await CreateItemAsync(party.Id, "CharSword", characterId: character.Id, type: "Weapon");

        var response = await _client.GetAsync($"/api/parties/{party.Id}/items?location=stash");
        var items = await response.Content.ReadFromJsonAsync<List<ItemResponse>>(Json);

        Assert.All(items!, i => Assert.Null(i.CharacterId));
        Assert.Contains(items!, i => i.Name == "StashPotion");
        Assert.DoesNotContain(items!, i => i.Name == "CharSword");
    }

    [Fact]
    public async Task ListItems_FilterByCharacter_ReturnsOnlyThatCharactersItems()
    {
        var party = await CreatePartyAsync("CharFilter Party");
        var character = await CreateCharacterAsync(party.Id, "Owner");
        await CreateItemAsync(party.Id, "Owned", characterId: character.Id);
        await CreateItemAsync(party.Id, "Unowned");

        var response = await _client.GetAsync($"/api/parties/{party.Id}/items?characterId={character.Id}");
        var items = await response.Content.ReadFromJsonAsync<List<ItemResponse>>(Json);

        Assert.All(items!, i => Assert.Equal(character.Id, i.CharacterId));
        Assert.Contains(items!, i => i.Name == "Owned");
        Assert.DoesNotContain(items!, i => i.Name == "Unowned");
    }

    [Fact]
    public async Task UpdateItem_MovesItemToCharacterAndBackToStash()
    {
        var party = await CreatePartyAsync("Move Party");
        var character = await CreateCharacterAsync(party.Id, "Carrier");
        var item = await CreateItemAsync(party.Id, "Lantern");
        Assert.Null(item.CharacterId);

        var toChar = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/items/{item.Id}",
            new { name = "Lantern", quantity = 1, type = "Gear", rarity = "Common", characterId = character.Id },
            Json);
        Assert.Equal(HttpStatusCode.OK, toChar.StatusCode);
        var moved = await toChar.Content.ReadFromJsonAsync<ItemResponse>(Json);
        Assert.Equal(character.Id, moved!.CharacterId);

        var toStash = await _client.PutAsJsonAsync(
            $"/api/parties/{party.Id}/items/{item.Id}",
            new { name = "Lantern", quantity = 1, type = "Gear", rarity = "Common", characterId = (Guid?)null },
            Json);
        var back = await toStash.Content.ReadFromJsonAsync<ItemResponse>(Json);
        Assert.Null(back!.CharacterId);
    }

    [Fact]
    public async Task UpdateItem_MoveToCharacterFromAnotherParty_ReturnsBadRequest()
    {
        var partyA = await CreatePartyAsync("MoveA");
        var partyB = await CreatePartyAsync("MoveB");
        var bChar = await CreateCharacterAsync(partyB.Id, "Stranger");
        var item = await CreateItemAsync(partyA.Id, "Coin", type: "Treasure");

        var response = await _client.PutAsJsonAsync(
            $"/api/parties/{partyA.Id}/items/{item.Id}",
            new { name = "Coin", quantity = 1, type = "Treasure", rarity = "Common", characterId = bChar.Id },
            Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteItem_RemovesItem()
    {
        var party = await CreatePartyAsync("Del Party");
        var item = await CreateItemAsync(party.Id, "Trash");

        var delete = await _client.DeleteAsync($"/api/parties/{party.Id}/items/{item.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var get = await _client.GetAsync($"/api/parties/{party.Id}/items/{item.Id}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task GetStash_ReturnsCoinsAndOnlyStashItems()
    {
        var party = await CreatePartyAsync("Stash Party");
        var character = await CreateCharacterAsync(party.Id, "Hoarder");
        await CreateItemAsync(party.Id, "StashGem", type: "Treasure");
        await CreateItemAsync(party.Id, "CharGem", characterId: character.Id, type: "Treasure");

        var stash = await _client.GetFromJsonAsync<StashResponse>($"/api/parties/{party.Id}/stash", Json);

        Assert.NotNull(stash);
        Assert.Contains(stash!.Items, i => i.Name == "StashGem");
        Assert.DoesNotContain(stash.Items, i => i.Name == "CharGem");
        Assert.All(stash.Items, i => Assert.Null(i.CharacterId));
    }

    [Fact]
    public async Task DeletingCharacter_MovesItemsToStash()
    {
        var party = await CreatePartyAsync("Fallback Party");
        var character = await CreateCharacterAsync(party.Id, "Doomed");
        var item = await CreateItemAsync(party.Id, "Heirloom", characterId: character.Id);

        var delete = await _client.DeleteAsync($"/api/parties/{party.Id}/characters/{character.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var fetched = await _client.GetFromJsonAsync<ItemResponse>($"/api/parties/{party.Id}/items/{item.Id}", Json);
        Assert.NotNull(fetched);
        Assert.Null(fetched!.CharacterId); // fell back to the stash
    }

    private async Task<PartyResponse> CreatePartyAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/parties", new { name }, Json);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PartyResponse>(Json))!;
    }

    private async Task<CharacterResponse> CreateCharacterAsync(Guid partyId, string name)
    {
        var response = await _client.PostAsJsonAsync($"/api/parties/{partyId}/characters", new { name }, Json);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CharacterResponse>(Json))!;
    }

    private async Task<ItemResponse> CreateItemAsync(
        Guid partyId, string name, Guid? characterId = null, string type = "Gear", string rarity = "Common")
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/parties/{partyId}/items",
            new { name, quantity = 1, valueGp = 0.0, weight = 0.0, type, rarity, equipped = false, characterId },
            Json);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ItemResponse>(Json))!;
    }
}
