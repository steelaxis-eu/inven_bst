---
description: How to provision an Azure RBAC-secured tenant database
---

# Azure RBAC Tenant Database Provisioning

Follow these steps to securely provision a new tenant database in the Azure SQL Elastic Pool using Managed Identity and RBAC.

## Prerequisites
- Azure CLI installed and authenticated.
- Permission to manage RBAC (User Access Administrator or Owner).
- Target Azure SQL Server and Elastic Pool already created.

## Steps

### 1. Create a User-Assigned Managed Identity
Create a dedicated identity for the application to interact with the tenant databases.

```bash
az identity create --name id-steelaxis-prod --resource-group rg-steelaxis
```

### 2. Provision the Tenant Database
Add a new database to the existing Elastic Pool.

```bash
az sql db create \
  --resource-group rg-steelaxis \
  --server srv-steelaxis \
  --name db-tenant-{TENANT_ID} \
  --elastic-pool pool-steelaxis \
  --backup-storage-redundancy Local
```

### 3. Setup RBAC Handshake
Grant the Managed Identity access to the SQL Server as an **Active Directory Admin** or specific database user.

// turbo
```bash
# Get the Principal ID of the Managed Identity
PRINCIPAL_ID=$(az identity show --name id-steelaxis-prod --resource-group rg-steelaxis --query principalId -o tsv)

# Grant 'SQL DB Contributor' to the identity at the server scope
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "SQL DB Contributor" \
  --scope /subscriptions/{SUB_ID}/resourceGroups/rg-steelaxis/providers/Microsoft.Sql/servers/srv-steelaxis
```

### 4. Direct SQL Authentication
In the SQL Database, add the Managed Identity as a user without a password.

```sql
-- Connect as Entra Admin and run:
CREATE USER [id-steelaxis-prod] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [id-steelaxis-prod];
ALTER ROLE db_datawriter ADD MEMBER [id-steelaxis-prod];
ALTER ROLE db_ddladmin ADD MEMBER [id-steelaxis-prod];
```

### 5. Update Tenant Catalog
Register the new database in the Master Catalog DB so the `ITenantProvider` can resolve it.

---

> [!IMPORTANT]
> **No Secrets**: Notice no passwords were generated or stored. The app uses `DefaultAzureCredential` to authenticate via the Managed Identity principal.
