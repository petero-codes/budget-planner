/** Portal version (injected at build via next.config.js → NEXT_PUBLIC_APP_VERSION). */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";
