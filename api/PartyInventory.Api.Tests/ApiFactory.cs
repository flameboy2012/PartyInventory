using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PartyInventory.Api.Data;
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

            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_db.GetConnectionString()));
        });
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
