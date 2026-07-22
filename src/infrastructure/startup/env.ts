/**
 * Startup environment validation — fail fast before serving traffic.
 * Never silently fall back to mock/defaults for production-critical settings.
 */

import "server-only";


export type RepositoryDriver = "mock" | "sql";

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  driver: RepositoryDriver | null;
  nodeEnv: string;
  sessionSecretOk: boolean;
  connectionStringConfigured: boolean;
  developmentToolkitEnabled: boolean;
};

function isBuildPhase(env: NodeJS.ProcessEnv): boolean {
  return env.NEXT_PHASE === "phase-production-build";
}

function isTestRuntime(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VITEST === "true" ||
    env.NODE_ENV === "test" ||
    env.ALLOW_MOCK_REPOSITORY === "true"
  );
}

/**
 * Resolve REPOSITORY_DRIVER with fail-fast rules.
 * - Required except during Next.js production build prerender and unit tests.
 * - Production runtime must be sql.
 * - Development may be mock XOR sql — never both, never unset.
 */
export function resolveRepositoryDriver(
  env: NodeJS.ProcessEnv = process.env
): RepositoryDriver {
  const raw = env.REPOSITORY_DRIVER?.trim().toLowerCase();
  const nodeEnv = env.NODE_ENV ?? "development";

  if (!raw) {
    if (isBuildPhase(env) || isTestRuntime(env)) return "mock";
    throw new Error(
      "REPOSITORY_DRIVER is required. Set REPOSITORY_DRIVER=sql or REPOSITORY_DRIVER=mock. Silent default to mock is not allowed."
    );
  }

  if (raw !== "mock" && raw !== "sql") {
    throw new Error(
      `REPOSITORY_DRIVER must be "mock" or "sql" (got "${env.REPOSITORY_DRIVER}").`
    );
  }

  if (nodeEnv === "production" && !isBuildPhase(env) && raw !== "sql") {
    throw new Error(
      "REPOSITORY_DRIVER=sql is required in production. Refusing to start with mock."
    );
  }

  return raw;
}

export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env
): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = env.NODE_ENV ?? "development";
  let driver: RepositoryDriver | null = null;

  try {
    driver = resolveRepositoryDriver(env);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const secret = env.SESSION_SECRET?.trim() ?? "";
  const sessionSecretOk = secret.length >= 32;
  if (nodeEnv === "production" && !isBuildPhase(env) && !sessionSecretOk) {
    errors.push(
      "SESSION_SECRET must be set to a string of at least 32 characters in production."
    );
  } else if (!sessionSecretOk && nodeEnv !== "test") {
    warnings.push(
      "SESSION_SECRET is missing or shorter than 32 characters. Development is using the built-in fallback; configure an explicit secret so development matches staging/production."
    );
  }

  const connectionStringConfigured = Boolean(
    env.SQLSERVER_CONNECTION_STRING?.trim()
  );
  if (driver === "sql" && !connectionStringConfigured && !isBuildPhase(env)) {
    warnings.push(
      "SQLSERVER_CONNECTION_STRING is unset. The application is currently using the built-in default connection string. Explicitly setting SQLSERVER_CONNECTION_STRING removes an implicit dependency and makes the runtime configuration deterministic."
    );
  }

  const toolkitFlag = env.ENABLE_DEVELOPMENT_TOOLKIT?.trim().toLowerCase();
  const developmentToolkitEnabled =
    toolkitFlag === "true" || toolkitFlag === "1";
  if (
    developmentToolkitEnabled &&
    nodeEnv === "production" &&
    !isBuildPhase(env)
  ) {
    errors.push(
      "ENABLE_DEVELOPMENT_TOOLKIT must not be enabled in production."
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    driver,
    nodeEnv,
    sessionSecretOk,
    connectionStringConfigured,
    developmentToolkitEnabled,
  };
}

export function assertEnvironmentValid(
  env: NodeJS.ProcessEnv = process.env
): EnvValidationResult {
  const result = validateEnvironment(env);
  if (!result.ok) {
    throw new Error(
      `Environment validation failed:\n- ${result.errors.join("\n- ")}`
    );
  }
  return result;
}
