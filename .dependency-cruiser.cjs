/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "client-to-application",
      severity: "error",
      comment: "lib/client must not import application layer",
      from: { path: "^src/lib/client" },
      to: { path: "^src/application" },
    },
    {
      name: "client-to-infrastructure",
      severity: "error",
      comment: "lib/client must not import infrastructure",
      from: { path: "^src/lib/client" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "shared-to-application",
      severity: "error",
      comment: "lib/shared must stay pure — no application",
      from: { path: "^src/lib/shared" },
      to: { path: "^src/application" },
    },
    {
      name: "shared-to-infrastructure",
      severity: "error",
      comment: "lib/shared must stay pure — no infrastructure",
      from: { path: "^src/lib/shared" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "domain-no-infrastructure",
      severity: "error",
      comment: "Domain must not depend on infrastructure",
      from: { path: "^src/domain" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "domain-no-application",
      severity: "error",
      comment: "Domain must not depend on application",
      from: { path: "^src/domain" },
      to: { path: "^src/application" },
    },
    {
      name: "application-no-sql-pool",
      severity: "error",
      comment: "Only infrastructure/repositories/sql may import the pool",
      from: { path: "^src/application" },
      to: { path: "pool\\.ts$" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    exclude: {
      path: ["node_modules", "\\.next", "tests/e2e"],
    },
  },
};
