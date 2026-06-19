# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (cached unless the project file changes)
COPY PartyInventory.Api.csproj ./
RUN dotnet restore

# Build & publish
COPY . ./
RUN dotnet publish -c Release -o /app/publish

# Dev stage — hot reload via `dotnet watch` (used by docker-compose.dev.yml)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dev
WORKDIR /src
ENV DOTNET_USE_POLLING_FILE_WATCHER=true
COPY PartyInventory.Api.csproj ./
RUN dotnet restore
COPY . ./
EXPOSE 8080
CMD ["dotnet", "watch", "run", "--no-launch-profile"]

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "PartyInventory.Api.dll"]
