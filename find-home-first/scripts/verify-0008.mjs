import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_market_research'
      AND column_name IN ('property_type_preferences', 'target_property_type')
    ORDER BY column_name
  `;
  for (const c of cols) {
    console.log(`${c.column_name}: ${c.data_type}, nullable=${c.is_nullable}`);
  }
  const count = await sql`SELECT COUNT(*) as n FROM drizzle.__drizzle_migrations`;
  console.log("Total migrations in DB:", count[0].n);
} finally {
  await sql.end();
}
