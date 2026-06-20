# Deploying to Azure

Hosts the app on **Azure Container Apps** with **Postgres Flexible Server**, mirroring
`docker-compose.yml`. Only the `web` app is public; `api` is private and reached through
the web BFF over the environment's internal network.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az login` done)
- No local Docker needed — images are built in the cloud with `az acr build`.

## One-time setup

```bash
# Pick your own names/region. ACR name must be globally unique, lowercase/numbers only.
RG=rg-party-inventory
LOC=uksouth
ACR=partyinvacr$RANDOM

az group create -n $RG -l $LOC

# Registry to hold the two images. No admin user needed — the apps pull with a
# managed identity (AcrPull), and `az acr build` authenticates as your az login.
az acr create -n $ACR -g $RG --sku Basic
```

## Build & push the images (cloud build, from the repo root)

```bash
az acr build -r $ACR -t party-api:latest ./api/PartyInventory.Api
az acr build -r $ACR -t party-web:latest ./web
```

## Deploy the infrastructure

```bash
az deployment group create \
  -g $RG \
  -f infra/main.bicep \
  -p acrName=$ACR \
     postgresAdminPassword='<a-strong-password>' \
     namePrefix=partyinv

# The web app's public URL is printed as the `webUrl` output:
az deployment group show -g $RG -n main --query properties.outputs.webUrl.value -o tsv
```

The api applies its EF migrations on startup (`ApplyMigrationsAtStartup=true`), so the
schema is provisioned automatically on first boot.

> **Permissions:** the deployment creates role assignments (AcrPull, Key Vault Secrets
> User), so the identity running the deploy needs **Owner** or **User Access Administrator**
> on the resource group — `Contributor` alone can't grant roles.

## Shipping a new version

```bash
az acr build -r $ACR -t party-api:latest ./api/PartyInventory.Api
az acr build -r $ACR -t party-web:latest ./web
# Roll a new revision that pulls the fresh :latest images:
az containerapp update -g $RG -n partyinv-api --image $ACR.azurecr.io/party-api:latest
az containerapp update -g $RG -n partyinv-web --image $ACR.azurecr.io/party-web:latest
```

## Networking / database privacy

The database has **no public network access**. It lives behind a private endpoint inside a
VNet, and the Container Apps environment is injected into the same VNet so the apps can
reach it — nothing else can. Layout:

```
VNet 10.0.0.0/16
├── infra subnet (10.0.0.0/23)  ── Container Apps environment (api + web run here)
└── pe subnet    (10.0.2.0/24)  ── Postgres private endpoint
                                    + private DNS zone privatelink.postgres.database.azure.com
```

The connection string still uses the server's normal FQDN; the private DNS zone resolves it
to the private IP from inside the VNet. The web app stays publicly reachable (its ingress
uses a public load balancer); only egress is routed through the VNet.

**Consequence: you can no longer reach the DB from your laptop** with psql/pgAdmin. To run
ad-hoc queries you need to be inside the VNet — e.g. `az containerapp exec` into the api
container, or stand up a small jumpbox VM in the VNet. Schema migrations are unaffected:
the api applies them on startup from inside the VNet.

## Notes / things to know

- **SignalR is pinned to a single api replica.** There's no backplane (Redis / Azure
  SignalR Service), so scaling the api beyond one replica would split realtime groups
  and break party sync. To scale out later, add the Azure SignalR Service and bump
  `maxReplicas` in `main.bicep`.
- **No secrets in app config.** Both apps run as a shared user-assigned managed identity.
  It pulls images from ACR via the `AcrPull` role, and the api reads the DB connection
  string from Key Vault (`db-connection` secret) via the `Key Vault Secrets User` role —
  resolved at runtime, never stored in the container app. Rotating the DB password means
  updating the Key Vault secret and rolling a new api revision.
- **Postgres TLS** uses `Trust Server Certificate=true` to avoid bundling the CA root in
  the image. Fine for getting started; wire up the real cert for stricter validation.
- **Scale to zero:** both container apps have `minReplicas: 0` and an HTTP scale rule, so
  they shut down when idle and cost nothing while down. The first request after idle pays
  a cold start of a few seconds (the api also cold-starts when the web BFF first calls it).
- **Postgres is the cost floor.** Flexible Server does *not* scale to zero — it stays on
  even while the apps are at zero, so it's the dominant idle cost. To pay nothing while not
  playing, stop it and start it on demand:

  ```bash
  az postgres flexible-server stop  -g $RG -n <server-name>   # name = postgresFqdn output, minus the domain
  az postgres flexible-server start -g $RG -n <server-name>
  ```

  (A stopped server auto-starts after 7 days.) `Standard_B1ms` Burstable is already the
  cheapest always-on tier if you'd rather leave it running.
