import fs from "fs";
import path from "path";
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/yarg_db";

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

console.log("🚀 Checking for SQL setup...");

const sqlPath = path.join(process.cwd(), "lib", "db", "setup", "setup_search.sql");

if (!fs.existsSync(sqlPath)) {
  console.error(`❌ SQL file not found at: ${sqlPath}`);
  await client.end();
  process.exit(1);
}

const fileContent = fs.readFileSync(sqlPath, "utf-8");

try {
  console.log("📝 Applying extensions, triggers, and indexes...");

  const statements = [];
  let currentStatement = "";
  let inDollarQuote = false;

  for (const line of fileContent.split("\n")) {
    currentStatement += line + "\n";

    if (line.includes("$$")) {
      inDollarQuote = !inDollarQuote;
    }

    if (!inDollarQuote && line.trim().endsWith(";")) {
      statements.push(currentStatement.trim());
      currentStatement = "";
    }
  }

  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  for (const statement of statements) {
    const display = statement.substring(0, 50).replace(/\n/g, " ");
    console.log(`📡 Executing: ${display}...`);
    await client.query(statement);
  }

  console.log("✅ SQL Setup applied successfully.");
} catch (e) {
  console.error("❌ Error applying SQL setup:", e);
  process.exit(1);
} finally {
  await client.end();
}
