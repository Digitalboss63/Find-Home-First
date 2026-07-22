import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only used for drizzle-kit commands; never at runtime.
    url: process.env.DATABASE_URL ?? "postgresql://localhost/find_home_first_placeholder",
  },
  verbose: false,
  strict: false,
});
