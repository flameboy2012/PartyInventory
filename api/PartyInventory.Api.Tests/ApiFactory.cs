using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using PartyInventory.Api.Data;
using PartyInventory.Api.Endpoints;
using Testcontainers.PostgreSql;

namespace PartyInventory.Api.Tests;

/// <summary>
/// Boots the API in-memory against a real PostgreSQL instance provided by Testcontainers.
/// The container is started once and shared across the test collection; EF migrations are
/// applied so the schema matches what production would have.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder("postgres:17")
        .Build();

    public async Task InitializeAsync()
    {
        await _db.StartAsync();

        // Accessing Services builds the host (using the container connection string), then we
        // apply migrations to the fresh database.
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await context.Database.MigrateAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(services =>
        {
            // Swap the app's DbContext registration for one pointed at the test container.
            var toRemove = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                         || d.ServiceType == typeof(AppDbContext))
                .ToList();
            foreach (var descriptor in toRemove)
            {
                services.Remove(descriptor);
            }

            // Interceptors come from DI so an individual test can add one (see the atomicity test)
            // via WithWebHostBuilder without rebuilding the container.
            services.AddDbContext<AppDbContext>((provider, options) =>
                options.UseNpgsql(_db.GetConnectionString())
                       .AddInterceptors(provider.GetServices<IInterceptor>()));
        });
    }

    /// <summary>The actor name every client from this factory sends unless a test overrides it.</summary>
    public const string DefaultActorName = "Test Player";

    // Mutating routes reject a request with no X-Actor-Name, so every client gets one by default.
    // Tests that care about the rejection clear or replace the header on their own request.
    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add(ActorName.HeaderName, DefaultActorName);
    }

    /// <summary>A client that sends no actor name, for testing the rejection.</summary>
    public HttpClient CreateClientWithoutActorName()
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Remove(ActorName.HeaderName);
        return client;
    }

    /// <summary>Reads straight from the database, for assertions the API surface doesn't expose.</summary>
    public async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        using var scope = Services.CreateScope();
        return await query(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    // Explicit implementation avoids clashing with WebApplicationFactory's ValueTask DisposeAsync.
    async Task IAsyncLifetime.DisposeAsync()
    {
        await _db.DisposeAsync();
        await base.DisposeAsync();
    }
}

[CollectionDefinition("api")]
public class ApiCollection : ICollectionFixture<ApiFactory>;
