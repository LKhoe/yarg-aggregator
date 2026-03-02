import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

interface DatabaseCache {
  conn: ReturnType<typeof drizzle> | null;
  promise: Promise<ReturnType<typeof drizzle>> | null;
}

declare global {
  var dbCache: DatabaseCache | undefined;
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/yarg_db";

const cached: DatabaseCache = global.dbCache ?? { conn: null, promise: null };
global.dbCache = cached;

async function createConnection() {
  if (cached.conn) {
    console.log("Using existing database connection");
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("Creating new database connection...");
    const client = postgres(DATABASE_URL, {
      max: 3,           // max pool connections (default is 10)
      idle_timeout: 20, // close idle connections after 20s
      // debug:
      //   process.env.NODE_ENV === "development"
      //     ? (connection, query, params) => {
      //         // console.log("🔍 DB Query:", query);
      //         // console.log("📋 Params:", params);
      //         // with the params replaced on the query
      //         console.log(
      //           "📋 Params Replaced:",
      //           query.replace(/\$\d+/g, (match) => {
      //             const param = params[Number(match.slice(1)) - 1];
      //             return typeof param === "string" ? `'${param}'` : param;
      //           }),
      //         );
      //       }
      //     : undefined,
    });
    cached.promise = Promise.resolve(drizzle(client, { schema }));
  }

  try {
    cached.conn = await cached.promise;
    console.log("Database connected successfully");
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Create and export the database instance
const db = await createConnection();

export { db };
export default createConnection;
