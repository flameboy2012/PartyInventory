// ---------------------------------------------------------------------------
// D&D Party Inventory — Azure hosting
//
// Provisions the whole stack on Azure, mirroring docker-compose.yml:
//   - Azure Container Apps environment (+ Log Analytics) ........ runtime
//   - api  container app  (.NET 10 minimal API, internal-only) .. private
//   - web  container app  (Next.js BFF, public) ................. public
//   - Azure Database for PostgreSQL Flexible Server ............. the db
//
// Only the web app is exposed to the internet. The browser talks to web; web's
// BFF proxies /api/* (incl. the SignalR hub) to the api over the environment's
// private network — so the api uses INTERNAL ingress and is never public.
//
// The container images must already exist in the registry before you deploy
// (see infra/README.md for the az acr build steps).
// ---------------------------------------------------------------------------

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Short prefix used to name resources. Lowercase letters/numbers only.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'partyinv'

@description('Name of an EXISTING Azure Container Registry (admin user enabled) that holds the images.')
param acrName string

@description('Image reference for the .NET API (repo:tag within the registry).')
param apiImage string = 'party-api:latest'

@description('Image reference for the Next.js web app (repo:tag within the registry).')
param webImage string = 'party-web:latest'

@description('PostgreSQL administrator login name.')
param postgresAdminLogin string = 'party'

@description('PostgreSQL administrator password.')
@secure()
@minLength(8)
param postgresAdminPassword string

@description('Name of the application database created on the server.')
param postgresDatabaseName string = 'party_inventory'

@description('Address space for the virtual network.')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Subnet the Container Apps environment is injected into. Delegated to Microsoft.App/environments; must be at least /27.')
param infraSubnetPrefix string = '10.0.0.0/23'

@description('Subnet that holds the database private endpoint.')
param privateEndpointSubnetPrefix string = '10.0.2.0/24'

// A short suffix keeps globally-unique names (registry login server, postgres
// FQDN) from colliding across deployments.
var suffix = uniqueString(resourceGroup().id)
var logName = '${namePrefix}-logs'
var envName = '${namePrefix}-env'
var pgServerName = '${namePrefix}-pg-${suffix}'
var vnetName = '${namePrefix}-vnet'
// Azure-managed private DNS zone name for Postgres Flexible Server private endpoints.
var postgresPrivateDnsZoneName = 'privatelink.postgres.database.azure.com'
// Key Vault names are global and capped at 24 chars.
var keyVaultName = take('${namePrefix}kv${suffix}', 24)

// Built-in role definition IDs.
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'          // AcrPull
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User

// Azure Postgres Flexible Server requires TLS. Trust Server Certificate avoids
// shipping the CA root in the image; drop it if you wire up the cert instead.
var postgresConnectionString = 'Host=${postgres.properties.fullyQualifiedDomainName};Port=5432;Database=${postgresDatabaseName};Username=${postgresAdminLogin};Password=${postgresAdminPassword};Ssl Mode=Require;Trust Server Certificate=true'

// ---------------------------------------------------------------------------
// Registry (already created, holds the pushed images)
// ---------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}

// ---------------------------------------------------------------------------
// Managed identity
//
// One user-assigned identity shared by both apps. It pulls images from ACR
// (AcrPull) and the api reads the DB connection string from Key Vault
// (Key Vault Secrets User) — so no registry password or secret value is ever
// stored in the app config.
// ---------------------------------------------------------------------------
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-id'
  location: location
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, appIdentity.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Networking
//
// One VNet with two subnets:
//   - infra ........ the Container Apps environment is injected here, so its apps
//                    run inside the VNet and can reach the private database.
//   - pe .......... holds the database's private endpoint (a private NIC/IP).
// ---------------------------------------------------------------------------
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: 'infra'
        properties: {
          addressPrefix: infraSubnetPrefix
          // A VNet-injected Container Apps (workload-profiles) environment requires
          // its subnet delegated to Microsoft.App/environments.
          delegations: [
            {
              name: 'aca'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'pe'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          // Private endpoints require network policies disabled on their subnet.
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource infraSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' existing = {
  parent: vnet
  name: 'infra'
}

resource peSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' existing = {
  parent: vnet
  name: 'pe'
}

// ---------------------------------------------------------------------------
// Observability + Container Apps environment
// ---------------------------------------------------------------------------
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    // Inject the environment into the VNet so its apps can reach the private DB.
    // internal: false keeps a public load balancer for the web app's external ingress;
    // only egress is routed through the VNet.
    vnetConfiguration: {
      infrastructureSubnetId: infraSubnet.id
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Flexible Server
// ---------------------------------------------------------------------------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      // No public access at all — the server is reachable only through the
      // private endpoint below. No firewall rules needed (or allowed) in this mode.
      publicNetworkAccess: 'Disabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: postgresDatabaseName
}

// ---------------------------------------------------------------------------
// Private DNS + private endpoint for the database
//
// The private DNS zone resolves the server's public FQDN to its private IP for
// anything inside the VNet (so the connection string can stay unchanged). The
// private endpoint is the actual private NIC in the pe subnet.
// ---------------------------------------------------------------------------
resource postgresPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: postgresPrivateDnsZoneName
  location: 'global'
}

resource postgresPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresPrivateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource postgresPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: '${pgServerName}-pe'
  location: location
  properties: {
    subnet: {
      id: peSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: '${pgServerName}-plsc'
        properties: {
          privateLinkServiceId: postgres.id
          groupIds: [
            'postgresqlServer'
          ]
        }
      }
    ]
  }
  dependsOn: [
    postgresDb
  ]
}

resource postgresPrivateDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: postgresPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'postgres'
        properties: {
          privateDnsZoneId: postgresPrivateDnsZone.id
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Key Vault — holds the DB connection string
//
// RBAC-authorized; the app identity is granted Key Vault Secrets User so the api
// can pull the secret at runtime. The value never appears in the app config.
// ---------------------------------------------------------------------------
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
  }
}

resource dbConnectionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'db-connection'
  properties: {
    value: postgresConnectionString
  }
}

resource kvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appIdentity.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// api — .NET minimal API (internal ingress, single replica for SignalR)
// ---------------------------------------------------------------------------
resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerEnv.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false          // private — only reachable from inside the environment (the web BFF)
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: appIdentity.id   // pull with the managed identity (AcrPull)
        }
      ]
      secrets: [
        {
          // Sourced from Key Vault at runtime via the managed identity — the
          // connection string value is never stored in the app config.
          name: 'db-connection'
          keyVaultUrl: dbConnectionSecret.properties.secretUri
          identity: appIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acr.properties.loginServer}/${apiImage}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Production'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            {
              name: 'ConnectionStrings__Default'
              secretRef: 'db-connection'
            }
            {
              // Provision/upgrade the schema on boot (as the compose stack does).
              name: 'ApplyMigrationsAtStartup'
              value: 'true'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      // Scale to zero when idle to save cost; the HTTP rule wakes it on the next
      // request (cold start of a few seconds). maxReplicas stays 1 because SignalR
      // has no backplane — a 2nd replica would split realtime groups. So it's only
      // ever 0 or 1. Raise max only after adding Azure SignalR Service / Redis.
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
  // Don't start the api until: the DB is reachable by name over the VNet
  // (private endpoint + DNS zone group), and the identity has both role grants
  // (so it can pull the image and read the KV secret on first boot).
  dependsOn: [
    postgresDb
    postgresPrivateDnsGroup
    acrPullAssignment
    kvSecretsUserAssignment
  ]
}

// ---------------------------------------------------------------------------
// web — Next.js BFF (public ingress)
// ---------------------------------------------------------------------------
resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-web'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerEnv.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true           // public — this is the only internet-facing app
        targetPort: 3000
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: appIdentity.id   // pull with the managed identity (AcrPull)
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${acr.properties.loginServer}/${webImage}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              // Server-side base URL the BFF uses to reach the private api app.
              name: 'API_BASE_URL'
              value: 'https://${apiApp.properties.configuration.ingress.fqdn}'
            }
          ]
        }
      ]
      // Scale to zero when idle; wakes on the next HTTP request (cold start).
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  // Wait for the AcrPull grant so the first revision can pull the image.
  dependsOn: [
    acrPullAssignment
  ]
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
@description('Public URL of the web app.')
output webUrl string = 'https://${webApp.properties.configuration.ingress.fqdn}'

@description('Private FQDN of the api app (not internet-reachable).')
output apiInternalFqdn string = apiApp.properties.configuration.ingress.fqdn

@description('PostgreSQL server FQDN (resolves to a private IP from inside the VNet only).')
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName

@description('Name of the virtual network the apps and database share.')
output vnetName string = vnet.name

@description('Key Vault holding the DB connection string.')
output keyVaultName string = keyVault.name
