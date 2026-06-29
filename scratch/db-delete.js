const postgres = require('postgres');
const sql = postgres('postgresql://postgres:hGLtysCSWpUWDWDDCxwMzPFYiCLTjZwR@switchback.proxy.rlwy.net:27675/railway');

async function main() {
  const id = 'ca0c28b4-26e7-4c93-9dc3-8efefcb54357'; // Fleetx1
  try {
    const res = await sql`DELETE FROM competitors WHERE id = ${id}`;
    console.log("Delete success", res);
  } catch (err) {
    console.error("Error", err);
  }
  await sql.end();
}
main();
