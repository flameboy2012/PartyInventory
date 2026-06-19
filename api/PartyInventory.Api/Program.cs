using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Data;
using PartyInventory.Api.Endpoints;
using PartyInventory.Api.Hubs;
using PartyInventory.Api.Realtime;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Serialize enums as their string names (e.g. "Weapon", "Rare") rather than integers.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddSignalR();
builder.Services.AddScoped<IPartyNotifier, PartyNotifier>();

var app = builder.Build();

// Optionally apply EF migrations on startup (enabled in the Docker/dev compose stack so the
// container provisions its own schema). Off by default — tests and other hosts don't run it.
if (app.Configuration.GetValue<bool>("ApplyMigrationsAtStartup"))
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // Browser API explorer (with "try it out") at /scalar, reading /openapi/v1.json.
    app.MapScalarApiReference(options => options.WithTitle("Party Inventory API"));
}

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapPartyEndpoints();
app.MapCharacterEndpoints();
app.MapItemEndpoints();
app.MapHub<PartyHub>("/api/hubs/party");

app.Run();

// Exposes the implicit top-level Program class to the test project (WebApplicationFactory<Program>).
public partial class Program;
