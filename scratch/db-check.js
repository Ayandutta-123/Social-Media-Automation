const postgres = require('postgres');
const sql = postgres('postgresql://postgres:hGLtysCSWpUWDWDDCxwMzPFYiCLTjZwR@switchback.proxy.rlwy.net:27675/railway');

async function main() {
  const res = await sql`
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE conrelid = 'competitors'::regclass;
  `;
  console.log(res);
  await sql.end();
}
main();
