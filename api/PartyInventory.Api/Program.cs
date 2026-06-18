using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Data;
using PartyInventory.Api.Endpoints;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

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

app.Run();

// Exposes the implicit top-level Program class to the test project (WebApplicationFactory<Program>).
public partial class Program;
