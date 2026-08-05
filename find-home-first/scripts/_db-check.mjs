import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

const tables = await sql`SELECT tablename FROM pg_tables WHERE tablename IN ('market_research_jobs','market_research_reports') ORDER BY tablename`;
console.log('TABLES:', tables.map(r => r.tablename).join(', '));

const idxs = await sql`SELECT indexname FROM pg_indexes WHERE tablename IN ('market_research_jobs','market_research_reports') ORDER BY indexname`;
console.log('INDEXES:', idxs.map(r => r.indexname).join(', '));

// Check drizzle journal if it exists
const journal = await sql`
  SELECT tag, created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 6
`.catch(() => []);
if (journal.length) {
  console.log('MIGRATION JOURNAL:');
  journal.forEach(r => console.log('  ' + r.tag));
} else {
  console.log('JOURNAL: (table not found or empty)');
}

await sql.end();
process.exit(0);
