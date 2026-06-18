using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PartyInventory.Api.Tests;

/// <summary>
/// Pins the API's OpenAPI document to a committed snapshot at <c>openapi/v1.json</c>.
/// The frontend generates its TypeScript types from that file, so this test fails whenever
/// the live document drifts from it — forcing a deliberate refresh + type regeneration.
///
/// To refresh after an intended API change, run the tests with the environment variable
/// <c>UPDATE_OPENAPI_SNAPSHOT=1</c> and commit the updated file.
/// </summary>
[Collection("api")]
public class OpenApiSnapshotTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task OpenApiDocument_MatchesCommittedSnapshot()
    {
        var live = Normalize(await _client.GetStringAsync("/openapi/v1.json"));
        var snapshotPath = SnapshotPath();

        var refresh = Environment.GetEnvironmentVariable("UPDATE_OPENAPI_SNAPSHOT") == "1";
        if (refresh || !File.Exists(snapshotPath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(snapshotPath)!);
            await File.WriteAllTextAsync(snapshotPath, live);
            return;
        }

        var committed = Normalize(await File.ReadAllTextAsync(snapshotPath));
        if (committed != live)
        {
            Assert.Fail(
                "The OpenAPI document no longer matches the committed snapshot at openapi/v1.json. " +
                "If this change is intended, re-run the tests with UPDATE_OPENAPI_SNAPSHOT=1, commit the " +
                "updated openapi/v1.json, and regenerate the frontend types.");
        }
    }

    private static string Normalize(string json) =>
        JsonNode.Parse(json)!.ToJsonString(new JsonSerializerOptions { WriteIndented = true });

    // Resolve the repo-root snapshot path relative to this source file (api/PartyInventory.Api.Tests).
    private static string SnapshotPath([CallerFilePath] string sourcePath = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(sourcePath)!, "..", "..", "openapi", "v1.json"));
}
