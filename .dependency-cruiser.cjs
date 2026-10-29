/**
 * Module boundaries (ARCHITECTURE §3): the domain never depends on delivery, UI never reaches the
 * database, and packages never depend on apps. Run with `pnpm lint:deps`.
 */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "packages-not-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "core-is-framework-free",
      comment: "Domain services must not import Next.js, React or UI packages.",
      severity: "error",
      from: { path: "^packages/core/" },
      to: { path: "node_modules/(next|react|react-dom)/|^packages/(ui|motion|tokens)/" },
    },
    {
      name: "ui-has-no-data-access",
      comment: "UI packages render props; they never touch the database or domain services.",
      severity: "error",
      from: { path: "^packages/(ui|motion|tokens|i18n)/" },
      to: { path: "^packages/(core|db)/|node_modules/(pg|drizzle-orm|bullmq|ioredis)/" },
    },
    {
      name: "db-below-core",
      severity: "error",
      from: { path: "^packages/db/" },
      to: { path: "^packages/core/" },
    },
    {
      name: "web-client-no-server-code",
      comment: "Client components reach the server only through server actions.",
      severity: "error",
      from: { path: "^apps/web/src/.*(Client|Form|Actions|Nav|Wizard)\\.tsx$" },
      to: { path: "^packages/(core|db)/|node_modules/(pg|drizzle-orm)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(\\.next|dist|coverage|node_modules)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
  },
};
