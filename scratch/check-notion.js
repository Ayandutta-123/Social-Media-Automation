// Check Notion database using direct fetch
require('dotenv').config({ path: '.env.local' });

const token = process.env.NOTION_TOKEN;
let dbId = process.env.NOTION_DATABASE_ID;

// Format UUID with hyphens
if (dbId && dbId.length === 32 && !dbId.includes('-')) {
  dbId = `${dbId.slice(0,8)}-${dbId.slice(8,12)}-${dbId.slice(12,16)}-${dbId.slice(16,20)}-${dbId.slice(20)}`;
}

console.log("DB ID:", dbId);

async function main() {
  // Query pages from the database
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 2 }),
  });

  const data = await res.json();

  if (data.object === 'error') {
    console.error("ERROR:", data.message);
    return;
  }

  console.log("Total results:", data.results.length);

  if (data.results.length > 0) {
    const page = data.results[0];
    const propKeys = Object.keys(page.properties);
    
    console.log("\n=== PROPERTY NAMES & TYPES ===");
    for (const key of propKeys) {
      console.log(`  "${key}" => ${page.properties[key].type}`);
    }

    console.log("\n=== FULL PROPERTY DATA (first row) ===");
    for (const key of propKeys) {
      console.log(`\n--- "${key}" ---`);
      console.log(JSON.stringify(page.properties[key], null, 2).substring(0, 600));
    }
  } else {
    console.log("Database is empty!");
  }
}

main().catch(console.error);
