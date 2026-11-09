// Drift check: fails if lib/db/schema.ts differs from the committed Drizzle migrations
// (i.e. someone edited the schema and forgot `npm run db:generate`).
// Non-interactive: drizzle-kit runs against a temp COPY of the migrations folder with stdin closed
// and a timeout, so a rename prompt can't hang it and nothing in the repo is modified.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "db-check-"));
const out = path.join(tmp, "migrations");
const config = path.join(tmp, "drizzle.check.json");
// drizzle-kit prefixes paths with "./", so paths given to it must be relative to the cwd
const rel = (p) => path.relative(root, p);
const sqlFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

try {
  cpSync(path.join(root, "lib/db/migrations"), out, { recursive: true });
  writeFileSync(
    config,
    JSON.stringify({ dialect: "postgresql", schema: "lib/db/schema.ts", out: rel(out) }),
  );
  const before = sqlFiles(out);

  const res = spawnSync("npx", ["--no-install", "drizzle-kit", "generate", "--config", rel(config)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"], // stdin closed: prompts can't wait for input
    timeout: 60_000,
    killSignal: "SIGKILL",
    encoding: "utf8",
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });

  // drizzle-kit exits 0 on some failures too, so also require one of its two known outcomes
  const nothingToDo = /No schema changes/i.test(res.stdout);
  const created = sqlFiles(out).filter((f) => !before.includes(f));
  if (res.error || res.status !== 0 || (!nothingToDo && created.length === 0)) {
    console.error(res.stdout, res.stderr);
    console.error(
      `db:check: drizzle-kit did not finish cleanly (${res.error?.message ?? `exit ${res.status}`}). ` +
        "Run `npm run db:generate` interactively and commit the result.",
    );
    process.exit(1);
  }

  if (created.length > 0) {
    console.error(
      `db:check: lib/db/schema.ts has changes with no committed migration (${created.join(", ")} would be generated).\n` +
        "Run `npm run db:generate` and commit the migration.",
    );
    process.exit(1);
  }
  console.log("db:check: schema and migrations are in sync.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
