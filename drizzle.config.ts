import { defineConfig } from "drizzle-kit";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL ||
  "postgresql://postgres@db.ogbwfaiejixjegcczcqw.supabase.co:5432/postgres";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
