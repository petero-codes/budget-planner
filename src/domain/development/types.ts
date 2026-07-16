export const DEVELOPMENT_CONFIRM_TOKENS = {
  REOPEN: "REOPEN",
  CLOSE: "CLOSE",
  CLONE: "CLONE",
  RESET: "RESET",
  CLEAR: "CLEAR",
  GENERATE: "GENERATE",
  DELETE_DEMO: "DELETE_DEMO",
  RESEED: "RESEED",
  INVALIDATE: "INVALIDATE",
  SIMULATE: "SIMULATE",
  VALIDATE: "VALIDATE",
  DIAGNOSE: "DIAGNOSE",
} as const;

export type DevelopmentConfirmToken =
  (typeof DEVELOPMENT_CONFIRM_TOKENS)[keyof typeof DEVELOPMENT_CONFIRM_TOKENS];

export type CloneFyOptions = {
  sourceFiscalYearId: string;
  targetYearLabel?: number;
  copyFinalizedAsDrafts: boolean;
  copyBudgetLines: boolean;
  copyAttachments: boolean;
};

export type CloneFyPreview = {
  sourceYearLabel: number;
  targetYearLabel: number;
  willCreate: {
    fiscalYear: boolean;
    submissionRows: number;
    draftBudgets: number;
    budgetLines: number;
    attachments: number;
  };
  willNotCopy: string[];
};

export type HealthCheck = {
  code: string;
  ok: boolean;
  label: string;
};

export type ToolkitHealth = {
  databaseStatus: "Healthy" | "Unhealthy";
  connectionStatus: "Healthy" | "Failed";
  checks: HealthCheck[];
  users: number;
  budgets: number;
  auditLogs: number;
  notifications: number;
  financeClaims: number;
  attachments: number;
  currentFyLabel: number | null;
  openFyLabel: number | null;
};

export type ToolkitEnvironment = {
  nodeEnv: string | undefined;
  toolkitEnabled: boolean;
  applicationVersion: string;
  gitCommit: string;
  buildTime: string;
  repositoryDriver: "sql" | "mock";
  currentFyLabel: number | null;
  openFyLabel: number | null;
  databaseLabel: string;
  migrationVersion: string;
  connectionHealthy: boolean;
  sessionSecret: "Configured" | "Missing";
  smtp: "Enabled" | "Disabled";
};

export type IntegrityFinding = {
  code: string;
  ok: boolean;
  message: string;
  count?: number;
};

export type DiagnosticsResult = {
  ranAt: string;
  checks: IntegrityFinding[];
  allOk: boolean;
};

export type SessionListItem = {
  sessionId: string;
  userId: string;
  userName: string;
  browser: string;
  platform: string;
  lastSeenAt: string;
};

/** Simulator moves to a stage — never Draft (use Reset Workflow). */
export type WorkflowSimulateTarget = "Manager" | "GM" | "Finance";
