import fs from "fs";
import path from "path";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/yarg_db";
const client = postgres(DATABASE_URL);

async function main() {
  console.log("🚀 Checking for SQL setup...");

  const sqlPath = path.join(
    process.cwd(),
    "lib",
    "db",
    "setup",
    "setup_search.sql",
  );

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found at: ${sqlPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(sqlPath, "utf-8");

  try {
    console.log("📝 Applying extensions, triggers, and indexes...");

    // Split the SQL into individual statements.
    // We iterate through lines and track dollar-quoted ($$) blocks.
    const statements: string[] = [];
    let currentStatement = "";
    let inDollarQuote = false;

    for (const line of fileContent.split("\n")) {
      currentStatement += line + "\n";

      // Toggle dollar quote state if we see '$$'
      if (line.includes("$$")) {
        inDollarQuote = !inDollarQuote;
      }

      // If we are not in a quote and the line ends with a semicolon, it's a complete statement
      if (!inDollarQuote && line.trim().endsWith(";")) {
        statements.push(currentStatement.trim());
        currentStatement = "";
      }
    }

    // Add any remaining content
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    for (const statement of statements) {
      const display = statement.substring(0, 50).replace(/\n/g, " ");
      console.log(`📡 Executing: ${display}...`);
      await client.unsafe(statement);
    }

    console.log("✅ SQL Setup applied successfully.");
  } catch (e) {
    console.error("❌ Error applying SQL setup:", e);
    process.exit(1);
  } finally {
    // Close the postgres connection
    await client.end();
  }
}

main();
