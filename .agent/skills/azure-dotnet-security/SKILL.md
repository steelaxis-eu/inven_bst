---
name: Azure .NET 10 Enterprise Security Skill
description: Expert instructions for building high-security, multi-tenant Azure-native applications using .NET 10, C# 14, and Azure SQL.
---

# Azure .NET 10 Enterprise Security Skill

This skill provides mandatory standards for refactoring and building the SteelAxis application to meet "Military-Grade" security and performance requirements using the latest .NET/Azure ecosystem.

## 1. Core Principles
- **Azure-Native**: Only Azure-native services (Entra ID, Blob, SQL, Front Door).
- **Lightning Fast**: Prioritize performance via Native AOT, PGO, and HybridCache.
- **Zero Trust**: No shared secrets. Everything uses Managed Identities.
- **Thin Client**: All business logic and calculations must reside in the .NET 10 Backend.
- **Tiered Multi-Tenancy**: 
  - **Free**: Schema-based isolation in a single DB.
  - **Paying**: Database-per-tenant in an Azure SQL Elastic Pool.
- **EN 1090 Compliance**: 
  - **Traceability**: Mandatory tracking of Heat Numbers and Traceability IDs.
  - **Immutable Audit**: All state changes affecting structural integrity must be logged.
- **One Tenant per Company**: Validate company identity via **VIES API**. Strictly enforce one registration per tenant.

## 2. Technical Standards

### .NET 10 & C# 14
- **C# 14 Features**: Use the `field` keyword for properties when custom logic is needed without explicit backing fields. Leverage extension members for clean API surfaces.
- **Span Efficiency**: Use `Span<T>` and `ReadOnlySpan<T>` for high-performance string and buffer manipulation to minimize GC pressure.
- **Clean Architecture**: 
  - `Core`: Rules and Entities (no dependencies).
  - `Infrastructure`: External integrations and DB context.
  - `API`: Request handling and RBAC enforcement.

### Multi-Tenancy & User Management
- **VIES Validation**: Implement VAT/Company registration validation before tenant creation.
- **Super Admin**: The first user of a tenant is assigned the `SuperAdmin` role.
- **RBAC Handshake**: Connection strings must NOT contain usernames or passwords. Use `Authentication=Active Directory Managed Identity` in connection strings.
- **Invitation Flow**: Use secure, short-lived tokens for user invitations via email.

### EN 1090 Compliance
- **Structural Traceability**: All `Part` entities must link to a `MaterialBatch`. Any part without a valid certificate is flagged as "Non-Compliant".
- **FPC Audit Logs**: Use EF Core Interceptors to automatically populate `AuditLog` tables for every mutation of `Part`, `WorkOrder`, or `InspectionRecord`.
- **Certificate Security**: Store Mill certificates in Azure Blob Storage with private access. Serve via SAS tokens or authenticated proxy only.
- **Data Retention**: Configure Azure SQL Long-Term Retention to keep structural data for 10+ years.
- **Native AOT Compatibility**: Avoid reflection in hot paths. Use Source Generators for JSON serialization and DI.
- **Span-First Parsing**: Use `ReadOnlySpan<char>` for drawing/PDF parsing logic.
- **HybridCache**: Use `HybridCache` for frequently accessed read-only data (e.g., Profile Shapes, Materials).
- **SQL Benchmarking**: Aim for <10ms latency for transactional queries. Use Hyperscale tier features.

## 3. Workflow Patterns

### Tenant Resolution
```csharp
// Use Finbuckle.MultiTenant or custom middleware
public class TenantProvider(IHttpContextAccessor context) : ITenantProvider 
{
    public string GetTenantId() => context.HttpContext?.Request.Headers["X-Tenant-Id"] ?? "Default";
}
```

### Passwordless DB Connection
```csharp
services.AddDbContext<SteelAxisDbContext>(options =>
{
    var connString = Configuration.GetConnectionString("AzureSql");
    options.UseSqlServer(connString, sqlOptions => 
    {
        // Use Managed Identity access token for the connection
    });
});
```
