/**
 * SQL Server repository adapters — implement I*Repository interfaces.
 * Swap via REPOSITORY_DRIVER=sql in infrastructure/di.ts.
 * Connection string from env: DATABASE_URL / SQLSERVER_CONNECTION_STRING.
 *
 * This module documents the Phase 4 contract. Mock repos remain default until
 * SQL Server is provisioned; do not invent connection credentials here.
 */
export const SQL_REPOSITORY_STATUS =
  "Pending environment: implement with parameterized queries + SqlUnitOfWork";
