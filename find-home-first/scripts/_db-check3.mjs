import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'prefer' });
const rows = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
