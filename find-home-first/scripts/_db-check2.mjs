import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'prefer' });

const allTables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'market%' ORDER BY tablename`;
console.log('MARKET TABLES:', allTables.map(r => r.tablename).join(', '));

const idxs = await sql`SELECT indexname FROM pg_indexes WHERE tablename IN ('market_research_jobs','market_research_reports') ORDER BY indexname`;
console.log('INDEXES:', idxs.map(r => r.indexname).join(', '));

const drizzleTables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='drizzle' ORDER BY tablename`.catch(() => []);
console.log('DRIZZLE SCHEMA TABLES:', drizzleTables.map(r => r.tablename).join(', ') || '(empty)');

const migrations = await sql`SELECT tag, created_at FROM drizzle.__drizzle_migrations ORDER BY id`.catch(() => []);
if (migrations.length) {
  console.log('APPLIED MIGRATIONS:');
  migrations.forEach(r => console.log('  ' + r.tag));
} else {
  console.log('APPLIED MIGRATIONS: (none or table missing)');
}

await sql.end();
process.exit(0);
