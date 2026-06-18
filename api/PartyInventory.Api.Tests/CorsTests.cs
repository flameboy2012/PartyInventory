using System.Net;

namespace PartyInventory.Api.Tests;

[Collection("api")]
public class CorsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Request_FromAllowedOrigin_GetsAllowOriginHeader()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/parties");
        request.Headers.Add("Origin", "http://localhost:3000");

        var response = await _client.SendAsync(request);

        Assert.True(
            response.Headers.Contains("Access-Control-Allow-Origin"),
            "Expected the CORS policy to echo the allowed origin.");
        Assert.Equal("http://localhost:3000", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task Preflight_FromAllowedOrigin_IsAllowed()
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/parties");
        request.Headers.Add("Origin", "http://localhost:3000");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:3000", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }
}
