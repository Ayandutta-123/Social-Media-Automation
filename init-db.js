require("dotenv").config({ path: ".env.local" });
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL);

async function init() {
  try {
    console.log("Creating competitors table...");
    await sql`
      CREATE TABLE IF NOT EXISTS competitors (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT,
        handle_url TEXT,
        status TEXT DEFAULT 'Active',
        last_scraped TEXT,
        posts_tracked INTEGER DEFAULT 0
      );
    `;

    console.log("Creating industries table...");
    await sql`
      CREATE TABLE IF NOT EXISTS industries (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        rotation_order INTEGER,
        posts_generated INTEGER DEFAULT 0,
        last_used TEXT
      );
    `;

    console.log("Tables created successfully!");
  } catch (err) {
    console.error("Error creating tables:", err);
  } finally {
    await sql.end();
  }
}

init();
