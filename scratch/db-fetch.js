const postgres = require('postgres');
const sql = postgres('postgresql://postgres:hGLtysCSWpUWDWDDCxwMzPFYiCLTjZwR@switchback.proxy.rlwy.net:27675/railway');

async function main() {
  const res = await sql`SELECT * FROM competitors LIMIT 5`;
  console.log(res);
  await sql.end();
}
main();
